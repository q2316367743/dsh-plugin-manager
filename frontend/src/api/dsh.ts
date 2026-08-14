/**
 * dsh 插件管理器 API 层：封装 Wails 服务绑定与浏览器原生能力（RL-03），
 * 组件 / store 一律经本模块访问，禁止直接触碰绑定。
 * 网络请求（npm / GitHub）直接走浏览器 fetch（Wails 本地 asset server 无 CORS 限制）。
 */
import { Events } from '@wailsio/runtime'
import {
  DshService,
  FileService,
  ProcService
} from '../../bindings/dsh-plugin-manager/services'
import type {
  AppSettings,
  DshResolveResult,
  GithubSearchHit,
  InstalledPackage,
  NpmSearchHit,
  ProfileExport,
  ProfileManifest
} from '@/types/dsh'
import {
  collectInsertRows,
  parsePatchEntries,
  removePatchEntry,
  serializePatch,
  setPatchConfigEntry,
  setRowsDisabled,
  togglePatchEntry
} from '@/utils/dsh/patch'

/** CLI 输出事件负载（对应 Go 侧 services.ProcOutput） */
interface ProcOutputPayload {
  jobId: string
  stream: string
  text: string
}

/** CLI 退出事件负载（对应 Go 侧 services.ProcExit） */
interface ProcExitPayload {
  jobId: string
  code: number
}

/** HTTP JSON 请求：超时、跟随重定向、JSON 解析（npm registry / GitHub API）。 */
async function httpJson(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: unknown
    timeout?: number
  } = {}
): Promise<unknown> {
  const { method = 'GET', headers = {}, body, timeout = 15000 } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': 'dsh-plugin-manager/1.0.0', Accept: 'application/json', ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      signal: controller.signal
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`)
    }
    return await res.json()
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`request timeout after ${timeout}ms`)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export const dshApi = {
  // ---- dsh 生态（Wails 服务绑定） ----
  getDshHome: (): Promise<string> => DshService.GetDshHome(),
  listProfiles: async (): Promise<string[]> => (await DshService.ListProfiles()) ?? [],

  readProfileManifest: async (profile: string): Promise<ProfileManifest | null> =>
    ((await DshService.ReadProfileManifest(profile)) ?? null) as ProfileManifest | null,

  writeProfileManifest: (profile: string, manifest: ProfileManifest): Promise<void> =>
    DshService.WriteProfileManifest(profile, manifest),

  readProfilePatch: (profile: string): Promise<string> => DshService.ReadProfilePatch(profile),
  writeProfilePatch: (profile: string, content: string): Promise<void> =>
    DshService.WriteProfilePatch(profile, content),

  readBundlePatch: (profile: string, packageName: string): Promise<string | null> =>
    DshService.ReadBundlePatch(profile, packageName),

  readInstalledPackage: async (
    profile: string,
    packageName: string
  ): Promise<InstalledPackage | null> =>
    ((await DshService.ReadInstalledPackage(profile, packageName)) ?? null) as InstalledPackage | null,

  resolveDshBin: (configuredPath: string): Promise<string | null> =>
    DshService.ResolveDshBin(configuredPath || ''),

  /** 解析 dsh 路径并探测运行方式（直接执行 / bun 兜底），返回合并结果 */
  async resolveDsh(configuredPath: string): Promise<DshResolveResult> {
    const r = await DshService.ResolveDsh(configuredPath || '')
    return {
      state: r.state as DshResolveResult['state'],
      path: r.path,
      command: r.command,
      prefix: r.prefix ?? [],
      version: r.version,
      error: r.error
    }
  },

  // ---- 进程 ----
  /**
   * 流式执行 CLI（等待退出），返回退出码。
   * 输出经事件 "proc:output" 推送（按 jobId 分发），退出后清理监听。
   */
  runCliStream(
    jobId: string,
    cmd: string,
    args: string[],
    detached: boolean,
    onOutput: (stream: 'stdout' | 'stderr', text: string) => void
  ): Promise<number> {
    return new Promise<number>((resolve) => {
      const offOutput = Events.On('proc:output', (ev: { data: ProcOutputPayload }) => {
        const payload = ev.data
        if (payload.jobId === jobId) onOutput(payload.stream as 'stdout' | 'stderr', payload.text)
      })
      const offExit = Events.On('proc:exit', (ev: { data: ProcExitPayload }) => {
        const payload = ev.data
        if (payload.jobId === jobId) {
          offOutput()
          offExit()
          resolve(payload.code ?? 1)
        }
      })
      void ProcService.RunCli(jobId, cmd, args, detached)
    })
  },

  /** 启动流式子进程（不等待退出，长驻服务用），返回 pid；启动失败返回 -1 */
  spawnStream(jobId: string, cmd: string, args: string[], detached: boolean): Promise<number> {
    return ProcService.RunCli(jobId, cmd, args, detached)
  },

  kill: (pid: number): Promise<boolean> => ProcService.Kill(pid),
  isAlive: (pid: number): Promise<boolean> => ProcService.IsAlive(pid),
  findPidByPort: (port: number): Promise<number | null> => ProcService.FindPidByPort(port),

  // ---- 网络（npm / github）----
  async searchNpm(query: string, size = 30): Promise<NpmSearchHit[]> {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(
      query
    )}&size=${size}`
    const res = (await httpJson(url)) as {
      objects: Array<{
        package: {
          name: string
          version: string
          description: string
          author?: string | { name?: string }
          homepage?: string
          keywords?: string[]
          links?: { homepage?: string }
        }
      }>
    }
    return (res.objects || []).map(({ package: pkg }) => ({
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      author:
        typeof pkg.author === 'string' ? pkg.author : pkg.author?.name,
      homepage: pkg.links?.homepage ?? pkg.homepage,
      keywords: pkg.keywords
    }))
  },

  async fetchLatestVersion(packageName: string): Promise<string | null> {
    try {
      const encoded = encodeURIComponent(packageName).replace(/%2F/g, '/')
      const res = (await httpJson(`https://registry.npmjs.org/${encoded}/latest`)) as {
        version?: string
      }
      return res.version ?? null
    } catch {
      return null
    }
  },

  async searchGithub(query: string, topicOnly = false): Promise<GithubSearchHit[]> {
    const q = topicOnly ? 'topic:dsh-plugin' : `topic:dsh-plugin ${query}`
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
      q
    )}&sort=updated&per_page=30`
    const res = (await httpJson(url, {
      headers: { Accept: 'application/vnd.github+json' }
    })) as {
      items: Array<{
        full_name: string
        name: string
        description: string | null
        html_url: string
        stargazers_count: number
        updated_at: string
      }>
    }
    return (res.items || []).map((item) => ({
      fullName: item.full_name,
      name: item.name,
      description: item.description ?? '',
      htmlUrl: item.html_url,
      stargazers: item.stargazers_count,
      updatedAt: item.updated_at
    }))
  },

  // ---- patch 操作 ----
  parsePatchEntries,
  collectInsertRows,
  togglePatchEntry,
  setRowsDisabled,
  setPatchConfigEntry,
  removePatchEntry,
  serializePatch,

  // ---- 导出 / 导入 ----
  buildExport(profile: string, bundles: string[], patchText: string): ProfileExport {
    return {
      profile,
      bundles: [...bundles],
      patches: parsePatchEntries(patchText),
      exportedAt: new Date().toISOString()
    }
  },

  writeTextFile: (filePath: string, content: string): Promise<void> =>
    FileService.WriteTextFile(filePath, content),

  readTextFile: (filePath: string): Promise<string> => FileService.ReadTextFile(filePath)
}

export type { AppSettings }

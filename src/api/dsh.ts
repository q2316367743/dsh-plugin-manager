/**
 * dsh 插件管理器 API 层：封装 window.preload 底层能力（RL-03），
 * 组件 / store 一律经本模块访问，禁止直接触碰 preload。
 */
import type {
  AppSettings,
  DshResolveResult,
  GithubSearchHit,
  InstalledPackage,
  NpmSearchHit,
  ProfileExport,
  ProfileManifest,
  SpawnHandlers
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

export const dshApi = {
  getDshHome: () => window.preload.dsh.getDshHome(),
  listProfiles: () => window.preload.dsh.listProfiles(),
  readProfileManifest: (profile: string): ProfileManifest | null =>
    window.preload.dsh.readProfileManifest(profile),
  writeProfileManifest: (profile: string, manifest: ProfileManifest) =>
    window.preload.dsh.writeProfileManifest(profile, manifest),
  readProfilePatch: (profile: string) => window.preload.dsh.readProfilePatch(profile),
  writeProfilePatch: (profile: string, content: string) =>
    window.preload.dsh.writeProfilePatch(profile, content),
  readBundlePatch: (profile: string, packageName: string) =>
    window.preload.dsh.readBundlePatch(profile, packageName),
  readInstalledPackage: (profile: string, packageName: string): InstalledPackage | null =>
    window.preload.dsh.readInstalledPackage(profile, packageName),
  getLogFile: (profile: string) => window.preload.dsh.getLogFile(profile),

  resolveDshBin: (configuredPath: string): string | null =>
    window.preload.dsh.resolveDshBin(configuredPath || undefined),

  /** 解析 dsh 路径并探测运行方式（直接执行 / bun 兜底），返回合并结果 */
  async resolveDsh(configuredPath: string): Promise<DshResolveResult> {
    return window.preload.dsh.resolveDsh(configuredPath || undefined)
  },

  // ---- 进程 ----
  spawnStream(
    cmd: string,
    args: string[],
    options?: { cwd?: string; env?: Record<string, string | undefined>; detached?: boolean },
    handlers?: SpawnHandlers
  ) {
    return window.preload.proc.spawnStream(cmd, args, options, handlers)
  },
  kill: (pid: number) => window.preload.proc.kill(pid),
  isAlive: (pid: number) => window.preload.proc.isAlive(pid),
  checkPort: (port: number) => window.preload.proc.checkPort(port),
  findPidByPort: (port: number) => window.preload.proc.findPidByPort(port),

  // ---- 网络（npm / github）----
  async searchNpm(query: string, size = 30): Promise<NpmSearchHit[]> {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(
      query
    )}&size=${size}`
    const res = (await window.preload.net.httpJson(url)) as {
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
      const res = (await window.preload.net.httpJson(
        `https://registry.npmjs.org/${encoded}/latest`
      )) as { version?: string }
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
    const res = (await window.preload.net.httpJson(url, {
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

  async writeTextFile(filePath: string, content: string): Promise<void> {
    window.preload.file.writeTextFile(filePath, content)
  },

  readTextFile(filePath: string): string {
    return window.preload.file.readTextFile(filePath)
  }
}

export type { AppSettings }

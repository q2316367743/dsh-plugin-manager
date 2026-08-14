/**
 * dsh 插件管理器 API 层：封装 Wails 服务绑定与浏览器原生能力（RL-03），
 * 组件 / store 一律经本模块访问，禁止直接触碰绑定。
 */
import { Events } from '@wailsio/runtime'
import { DshService, ProcService } from '../../bindings/dsh-plugin-manager/services'
import type {
  AppSettings,
  DshResolveResult,
  InstalledPackage,
  ProfileManifest
} from '@/types/dsh'
import {
  collectInsertRows,
  parsePatchEntries,
  removePatchEntry,
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

  /**
   * 可中断的流式 CLI 执行：启动后返回 pid 与等待退出的 Promise，
   * 可经 kill(pid) 中途终止；进程退出（含被杀）后自动清理监听。
   * 启动失败（pid ≤ 0）时清理监听并返回，此时 exit 不会 resolve。
   */
  runCliInterruptible(
    jobId: string,
    cmd: string,
    args: string[],
    onOutput: (stream: 'stdout' | 'stderr', text: string) => void
  ): Promise<{ pid: number; exit: Promise<number> }> {
    return new Promise((resolve) => {
      let offOutput = () => {}
      let offExit = () => {}
      const exit = new Promise<number>((resolveExit) => {
        offExit = Events.On('proc:exit', (ev: { data: ProcExitPayload }) => {
          const payload = ev.data
          if (payload.jobId === jobId) {
            offOutput()
            offExit()
            resolveExit(payload.code ?? 1)
          }
        })
      })
      offOutput = Events.On('proc:output', (ev: { data: ProcOutputPayload }) => {
        const payload = ev.data
        if (payload.jobId === jobId) onOutput(payload.stream as 'stdout' | 'stderr', payload.text)
      })
      void ProcService.RunCli(jobId, cmd, args, false).then((pid) => {
        if (pid <= 0) {
          offOutput()
          offExit()
        }
        resolve({ pid, exit })
      })
    })
  },

  /** 启动流式子进程（不等待退出，长驻服务用），返回 pid；启动失败返回 -1 */
  spawnStream(jobId: string, cmd: string, args: string[], detached: boolean): Promise<number> {
    return ProcService.RunCli(jobId, cmd, args, detached)
  },

  kill: (pid: number): Promise<boolean> => ProcService.Kill(pid),
  isAlive: (pid: number): Promise<boolean> => ProcService.IsAlive(pid),
  findPidByPort: (port: number): Promise<number | null> => ProcService.FindPidByPort(port),

  // ---- patch 操作 ----
  parsePatchEntries,
  collectInsertRows,
  togglePatchEntry,
  setRowsDisabled,
  setPatchConfigEntry,
  removePatchEntry
}

export type { AppSettings }

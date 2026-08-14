/**
 * DSH 插件管理器领域类型
 */

/** profile 级 cordis.patch.yml 中的一行（id 定位的覆盖条目） */
export interface PatchEntry {
  id: string
  name?: string
  disabled?: boolean
  config?: Record<string, unknown>
}

/** bundle 自带 patch 中 insert 的行引用 */
export interface BundleRowRef {
  id: string
  name?: string
}

export type BundleSource = 'npm' | 'github' | 'local' | 'unknown'

/** 合并 bundle 清单与 patch 状态后的插件项 */
export interface BundleItem {
  /** npm 包名 */
  name: string
  /** 已安装版本 */
  version: string
  description: string
  homepage?: string
  repository?: string
  /** 官方（@deepseek-ai/ scope） */
  official: boolean
  source: BundleSource
  /** 该 bundle 插入的行 id 列表（启用/禁用按行定位） */
  rows: BundleRowRef[]
  /** 合并 patch 后的启用状态 */
  enabled: boolean
  /** 检查更新结果 */
  latest?: string
  hasUpdate: boolean
  checking: boolean
}

/** profile 详情：原始 bundles + patch + 合并视图 */
export interface ProfileDetail {
  name: string
  /** 原始 dsh.profile.bundles 顺序 */
  bundles: string[]
  patches: PatchEntry[]
  items: BundleItem[]
}

export interface ProfileManifest {
  name?: string
  private?: boolean
  dependencies?: Record<string, string>
  dsh?: {
    profile?: {
      bundles?: string[]
    }
  }
  [key: string]: unknown
}

export interface InstalledPackage {
  name: string
  version: string
  description?: string
  homepage?: string
  repository?: string | { url?: string; type?: string }
  [key: string]: unknown
}

export type DshState = 'ok' | 'missing' | 'invalid'

export interface DshResolveResult {
  state: DshState
  /** 实际使用的 dsh 文件路径（展示用） */
  path?: string
  /** 实际执行的命令（dsh 直接执行，或 bun 兜底解释执行） */
  command?: string
  /** bun 兜底时命令前缀，如 [dshPath] */
  prefix?: string[]
  version?: string
  error?: string
}

export type ServerStatus = 'unknown' | 'stopped' | 'running-own' | 'running-foreign'

export interface ServerState {
  status: ServerStatus
  port: number
  pid?: number
  /** 最近日志文本（界面展示用） */
  logTail: string
  /** 是否正在启动/停止 */
  busy: boolean
}

export type ThemeMode = 'light' | 'dark' | 'system'
export type Lang = 'zh' | 'en'

export interface AppSettings {
  /** 手动配置的 dsh 可执行文件路径 */
  dshPath: string
  /** web 服务端口 */
  port: number
  /** 启用/禁用/卸载插件后询问是否立即重启 web 服务 */
  confirmRestart: boolean
}

export interface NpmSearchHit {
  name: string
  version: string
  description: string
  author?: string
  homepage?: string
  keywords?: string[]
}

export interface GithubSearchHit {
  fullName: string
  name: string
  description: string
  htmlUrl: string
  stargazers: number
  updatedAt: string
}

export interface SpawnHandlers {
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
  onExit?: (result: { code: number | null; signal: string | null }) => void
  onError?: (error: Error) => void
}

/**
 * DSH 插件管理器全局 store：profile / bundle / patch / dsh 解析 / web 服务 / 设置。
 */
import { defineStore } from 'pinia'
import { dshApi } from '@/api/dsh'
import { KeyValueUtil } from '@/utils/native'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import type {
  AppSettings,
  BundleItem,
  BundleRowRef,
  DshResolveResult,
  ProfileDetail,
  ProfileExport,
  ServerState
} from '@/types/dsh'
import { parsePatchEntries, readPatchConfig } from '@/utils/dsh/patch'

const PATCH_HEADER = `# dsh profile patch layer — managed by DSH Plugin Manager
# 由 DSH 插件管理器维护；手动编辑同样生效，管理器保存时会整体重写。
# Managed by DSH Plugin Manager; manual edits are respected but rewritten on save.`

const defaultSettings: AppSettings = { dshPath: '', port: 3080, confirmRestart: true }

function loadSettings(): AppSettings {
  const saved = KeyValueUtil.getItem<Partial<AppSettings>>(LocalNameEnum.KEY_DSH_SETTINGS)
  return { ...defaultSettings, ...(saved ?? {}) }
}

function persistSettings(settings: AppSettings) {
  // 传普通对象副本：pinia 的 state 是 reactive 代理，
  // 直接交给 utools dbStorage 会触发 DataCloneError（An object could not be cloned）
  KeyValueUtil.setItem(LocalNameEnum.KEY_DSH_SETTINGS, { ...settings })
}

function serverKey(profile: string): string {
  return `${LocalNameEnum.KEY_DSH_SERVER}/${profile}`
}

function isOfficial(name: string): boolean {
  return name.startsWith('@deepseek-ai/')
}

function detectSource(
  name: string,
  dependencySpec: string | undefined,
  homepage: string | undefined,
  repository: string | { url?: string } | undefined
): BundleItem['source'] {
  if (!dependencySpec) return 'unknown'
  if (/^github:|^git\+|\.git(?:#|$)/.test(dependencySpec)) return 'github'
  if (/^file:|^link:/.test(dependencySpec)) return 'local'
  const repoUrl = typeof repository === 'string' ? repository : repository?.url
  if (repoUrl?.includes('github.com')) return 'github'
  if (homepage?.includes('github.com')) return 'github'
  return 'npm'
}

export const useDshStore = defineStore('dsh', {
  state: () => ({
    profiles: [] as string[],
    currentProfile: '',
    detail: null as ProfileDetail | null,
    loading: false,
    dsh: { state: 'missing' } as DshResolveResult,
    settings: loadSettings(),
    server: { status: 'unknown', port: 3080, logTail: '', busy: false } as ServerState,
    /** utools 子输入框过滤词 */
    filter: '',
    /** 纯净模式（仅保留 @deepseek-ai/ 官方插件） */
    pureMode: false,
    /** 插件安装/移除 CLI 是否在跑（禁用相关按钮） */
    cliBusy: false
  }),

  getters: {
    dshOk: (state) => state.dsh.state === 'ok',
    officialBundles: (state) => state.detail?.items.filter((i) => i.official) ?? [],
    thirdPartyBundles: (state) => state.detail?.items.filter((i) => !i.official) ?? [],
    /** 该 profile 是否包含 dsh web 应用（展示服务控制卡片） */
    hasWebApp: (state) => !!state.detail?.bundles.includes('@deepseek-ai/dsh-web-app')
  },

  actions: {
    /** 启动初始化：列 profile、解析 dsh、加载第一个 profile */
    async init() {
      this.profiles = dshApi.listProfiles()
      if (!this.currentProfile) this.currentProfile = this.profiles[0] ?? ''
      await this.resolveDsh()
      if (this.currentProfile) await this.loadProfile(this.currentProfile)
      await this.refreshServerStatus()
    },

    async selectProfile(name: string) {
      this.currentProfile = name
      await this.loadProfile(name)
      await this.refreshServerStatus()
    },

    /** 加载 profile 详情：合并 bundles + cordis.patch.yml 为插件列表 */
    async loadProfile(name: string) {
      this.loading = true
      try {
        const manifest = dshApi.readProfileManifest(name)
        const bundles = manifest?.dsh?.profile?.bundles ?? []
        const dependencies = manifest?.dependencies ?? {}
        const patchText = dshApi.readProfilePatch(name)
        const patches = parsePatchEntries(patchText)
        const disabledIds = new Set(
          patches.filter((p) => p.disabled === true).map((p) => p.id)
        )
        const items: BundleItem[] = bundles.map((bundleName) =>
          this.buildBundleItem(name, bundleName, dependencies[bundleName], disabledIds)
        )
        this.detail = { name, bundles, patches, items }
        const thirdParty = items.filter((i) => !i.official)
        this.pureMode = thirdParty.length > 0 && thirdParty.every((i) => !i.enabled)
      } finally {
        this.loading = false
      }
    },

    buildBundleItem(
      profile: string,
      bundleName: string,
      dependencySpec: string | undefined,
      disabledIds: Set<string>
    ): BundleItem {
      const pkg = dshApi.readInstalledPackage(profile, bundleName)
      const rows = this.resolveBundleRows(profile, bundleName)
      const repository = pkg?.repository
      const homepage = pkg?.homepage
      const enabled = rows.every((row) => !disabledIds.has(row.id))
      return {
        name: bundleName,
        version: pkg?.version ?? 'unknown',
        description: pkg?.description ?? '',
        homepage,
        repository: typeof repository === 'string' ? repository : repository?.url,
        official: isOfficial(bundleName),
        source: detectSource(bundleName, dependencySpec, homepage, repository),
        rows,
        enabled,
        hasUpdate: false,
        checking: false
      }
    },

    /** 解析 bundle 插入的行 id；解析不到时回退为包名 */
    resolveBundleRows(profile: string, bundleName: string): BundleRowRef[] {
      const patchText = dshApi.readBundlePatch(profile, bundleName)
      const rows = dshApi.collectInsertRows(patchText)
      return rows.length > 0 ? rows : [{ id: bundleName }]
    },

    // ---- dsh 可执行文件 ----
    async resolveDsh() {
      this.dsh = await dshApi.resolveDsh(this.settings.dshPath)
      return this.dsh
    },

    /** 保存手动配置的 dsh 路径并重新校验 */
    async saveDshPath(path: string) {
      this.settings = { ...this.settings, dshPath: path }
      persistSettings(this.settings)
      await this.resolveDsh()
      if (this.dsh.state === 'ok') {
        // dsh 就绪后刷新 profile 详情
        if (this.currentProfile) await this.loadProfile(this.currentProfile)
      }
    },

    saveSettings(partial: Partial<AppSettings>) {
      this.settings = { ...this.settings, ...partial }
      persistSettings(this.settings)
    },

    // ---- 启用 / 禁用 / 排序 ----
    async toggleBundle(bundle: BundleItem, enabled: boolean) {
      if (!this.detail) return
      const rowIds = bundle.rows.map((row) => row.id)
      const patchText = dshApi.setRowsDisabled(
        dshApi.readProfilePatch(this.currentProfile),
        rowIds,
        !enabled
      )
      dshApi.writeProfilePatch(this.currentProfile, patchText)
      await this.loadProfile(this.currentProfile)
    },

    async moveBundle(from: number, to: number) {
      if (!this.detail) return
      const bundles = [...this.detail.bundles]
      const [item] = bundles.splice(from, 1)
      bundles.splice(to, 0, item)
      const manifest = dshApi.readProfileManifest(this.currentProfile)
      if (!manifest) return
      manifest.dsh = { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles } }
      dshApi.writeProfileManifest(this.currentProfile, manifest)
      await this.loadProfile(this.currentProfile)
    },

    // ---- 纯净模式 ----
    async setPureMode(on: boolean) {
      if (!this.detail) return
      const thirdPartyRows = this.detail.items
        .filter((i) => !i.official)
        .flatMap((i) => i.rows.map((row) => row.id))
      const patchText = dshApi.setRowsDisabled(
        dshApi.readProfilePatch(this.currentProfile),
        thirdPartyRows,
        on
      )
      dshApi.writeProfilePatch(this.currentProfile, patchText)
      await this.loadProfile(this.currentProfile)
    },

    // ---- 插件 config ----
    /** 读取某行的 config 覆盖（profile patch 中） */
    readPluginConfig(rowId: string): Record<string, unknown> | undefined {
      return readPatchConfig(dshApi.readProfilePatch(this.currentProfile), rowId)
    },

    /** 保存某行的 config 覆盖到 profile patch */
    async savePluginConfig(rowId: string, config: Record<string, unknown>) {
      const patchText = dshApi.setPatchConfigEntry(
        dshApi.readProfilePatch(this.currentProfile),
        rowId,
        config
      )
      dshApi.writeProfilePatch(this.currentProfile, patchText)
      await this.loadProfile(this.currentProfile)
    },

    // ---- CLI（安装 / 移除 / 更新）----
    /** 组装 dsh 实际执行命令（直接执行或 bun 兜底解释执行） */
    dshCommand(): { command: string; prefix: string[] } | null {
      if (!this.dshOk) return null
      const command = this.dsh.command ?? this.dsh.path
      const prefix = this.dsh.prefix ?? []
      return command ? { command, prefix } : null
    },

    /** 执行 dsh CLI 并流式回调输出，返回退出码 */
    async runCli(args: string[], onOutput: (chunk: string) => void): Promise<number> {
      const runner = this.dshCommand()
      if (!runner) {
        onOutput('dsh not found — please configure the dsh executable first\n')
        return 1
      }
      this.cliBusy = true
      try {
        return await new Promise<number>((resolve) => {
          dshApi.spawnStream(
            runner.command,
            [...runner.prefix, ...args],
            {},
            {
              onStdout: (chunk) => onOutput(chunk),
              onStderr: (chunk) => onOutput(chunk),
              onExit: ({ code }) => resolve(code ?? 1),
              onError: (error) => {
                onOutput(`spawn error: ${error.message}\n`)
                resolve(1)
              }
            }
          )
        })
      } finally {
        this.cliBusy = false
      }
    },

    /** 安装插件（spec 支持 pkg / pkg@version / github:user/repo / git 地址） */
    async installBundle(spec: string, onOutput: (chunk: string) => void): Promise<boolean> {
      const code = await this.runCli(
        ['plugin', '--profile', this.currentProfile, 'add', spec],
        onOutput
      )
      if (code === 0) await this.loadProfile(this.currentProfile)
      return code === 0
    },

    async removeBundle(bundle: BundleItem, onOutput: (chunk: string) => void): Promise<boolean> {
      const code = await this.runCli(
        ['plugin', '--profile', this.currentProfile, 'remove', bundle.name],
        onOutput
      )
      if (code === 0) await this.loadProfile(this.currentProfile)
      return code === 0
    },

    async updateBundle(bundle: BundleItem, onOutput: (chunk: string) => void): Promise<boolean> {
      const code = await this.runCli(
        ['plugin', '--profile', this.currentProfile, 'add', `${bundle.name}@latest`],
        onOutput
      )
      if (code === 0) await this.loadProfile(this.currentProfile)
      return code === 0
    },

    // ---- 检查更新 ----
    async checkUpdates(): Promise<number> {
      if (!this.detail) return 0
      let updated = 0
      for (const item of this.detail.items) {
        item.checking = true
        try {
          if (item.source !== 'npm') {
            item.hasUpdate = false
            continue
          }
          const latest = await dshApi.fetchLatestVersion(item.name)
          if (latest && latest !== item.version) {
            item.latest = latest
            item.hasUpdate = true
            updated++
          } else {
            item.hasUpdate = false
          }
        } finally {
          item.checking = false
        }
      }
      return updated
    },

    // ---- web 服务 ----
    /**
     * 刷新服务状态。判定依据：
     * 1. 记录在案的启动 PID 仍存活 → 本管理器启动；
     * 2. 否则查端口监听者（lsof）→ 外部启动；
     * 3. 均无 → 未启动。
     * 不依赖 TCP 探测，避免系统代理劫持端口导致误报。
     */
    async refreshServerStatus() {
      const port = this.settings.port
      const saved = KeyValueUtil.getItem<{ pid?: number; port?: number }>(
        serverKey(this.currentProfile)
      )
      const recordedPid = saved?.pid
      if (recordedPid && dshApi.isAlive(recordedPid)) {
        this.server = {
          status: 'running-own',
          port,
          pid: recordedPid,
          logTail: this.server.logTail,
          busy: false
        }
        return
      }
      const listeningPid = dshApi.findPidByPort(port)
      if (listeningPid) {
        this.server = {
          status: 'running-foreign',
          port,
          pid: listeningPid,
          logTail: this.server.logTail,
          busy: false
        }
        return
      }
      this.server = {
        status: 'stopped',
        port,
        pid: undefined,
        logTail: this.server.logTail,
        busy: false
      }
    },

    async serverStart() {
      // 互斥：busy 置位是同步的，重入直接忽略，防止重复点击重复启动
      if (this.server.busy) return
      const runner = this.dshCommand()
      if (!runner) return
      this.server.busy = true
      try {
        const port = this.settings.port
        // 已在运行则直接刷新状态
        await this.refreshServerStatus()
        if (this.server.status !== 'stopped') return
        let tail = ''
        const handlers = {
          onStdout: (chunk: string) => {
            tail += chunk
            this.server.logTail = tail.slice(-6000)
          },
          onStderr: (chunk: string) => {
            tail += chunk
            this.server.logTail = tail.slice(-6000)
          }
        }
        const handle = dshApi.spawnStream(
          runner.command,
          [...runner.prefix, '--profile', this.currentProfile, '--port', String(port)],
          { detached: true },
          handlers
        )
        if (handle.pid) {
          KeyValueUtil.setItem(serverKey(this.currentProfile), { pid: handle.pid, port })
        }
        // 等待端口监听就绪后刷新状态
        const deadline = Date.now() + 15000
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          await this.refreshServerStatus()
          if (this.server.status !== 'stopped') break
          // 进程已退出且未监听端口 → 启动失败，提前结束
          if (handle.pid && !dshApi.isAlive(handle.pid)) break
        }
      } finally {
        this.server.busy = false
      }
    },

    async serverStop() {
      // 互斥：与启动共用 busy 标志，防止操作期间重入
      if (this.server.busy) return
      this.server.busy = true
      try {
        const saved = KeyValueUtil.getItem<{ pid?: number }>(serverKey(this.currentProfile))
        const recordedPid = saved?.pid ?? this.server.pid
        // 先杀记录的进程，再清残留监听者（dsh 可能 fork 子进程占端口）
        if (recordedPid && dshApi.isAlive(recordedPid)) {
          await dshApi.kill(recordedPid)
        }
        const listener = dshApi.findPidByPort(this.settings.port)
        if (listener && listener !== recordedPid) {
          await dshApi.kill(listener)
        }
        KeyValueUtil.removeItem(serverKey(this.currentProfile))
        await this.refreshServerStatus()
      } finally {
        this.server.busy = false
      }
    },

    serverOpen() {
      window.preload.inject.shell.openExternal(
        `http://127.0.0.1:${this.settings.port}`
      )
    },

    /** 重启 web 服务（仅对本管理器启动的服务生效），返回是否已重启 */
    async restartServer(): Promise<boolean> {
      if (this.server.status !== 'running-own') return false
      await this.serverStop()
      await this.serverStart()
      return true
    },

    // ---- 导出 / 导入 ----
    /** 导出 profile 视图，返回导出文件路径（取消返回 null） */
    exportProfile(): string | null {
      if (!this.detail) return null
      const defaultPath = dshApi.getDshHome() + `/${this.currentProfile}-profile-export.json`
      const path = window.preload.inject.dialog.save({
        title: 'Export profile view',
        defaultPath,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (!path) return null
      const payload = dshApi.buildExport(
        this.currentProfile,
        this.detail.bundles,
        dshApi.readProfilePatch(this.currentProfile)
      )
      dshApi.writeTextFile(path, JSON.stringify(payload, null, 2))
      return path
    },

    /** 导入 profile 视图文件，返回缺失的 bundle 名列表 */
    async importProfileFromFile(path: string): Promise<{ missing: string[] }> {
      const raw = dshApi.readTextFile(path)
      let data: ProfileExport
      try {
        data = JSON.parse(raw) as ProfileExport
      } catch (e) {
        throw new Error(`invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
      }
      if (!Array.isArray(data.bundles) || !Array.isArray(data.patches)) {
        throw new Error('missing "bundles" or "patches" array')
      }
      const manifest = dshApi.readProfileManifest(this.currentProfile)
      if (!manifest) throw new Error('profile manifest not found')
      const dependencies = Object.keys(manifest.dependencies ?? {})
      const missing = data.bundles.filter((name) => !dependencies.includes(name))
      manifest.dsh = { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles: data.bundles } }
      dshApi.writeProfileManifest(this.currentProfile, manifest)
      dshApi.writeProfilePatch(this.currentProfile, dshApi.serializePatch(data.patches, PATCH_HEADER))
      await this.loadProfile(this.currentProfile)
      return { missing }
    }
  }
})

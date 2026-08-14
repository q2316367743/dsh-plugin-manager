/**
 * DSH 插件管理器全局 store：profile / bundle / patch / dsh 解析 / web 服务 / 设置。
 */
import { defineStore } from 'pinia'
import { dshApi } from '@/api/dsh'
import { KeyValueUtil } from '@/utils/native'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import {
  attachServerLog,
  openServer,
  refreshServerStatus,
  restartServer,
  startServer,
  stopServer
} from './server'
import type {
  AppSettings,
  BundleItem,
  BundleRowRef,
  DshResolveResult,
  ProfileDetail,
  ServerState
} from '@/types/dsh'
import { parsePatchEntries, readPatchConfig } from '@/utils/dsh/patch'

const defaultSettings: AppSettings = { dshPath: '', port: 3080, confirmRestart: true }

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
    settings: { ...defaultSettings },
    server: { status: 'unknown', port: 3080, logTail: '', busy: false } as ServerState,
    /** web 服务进程的 jobId（事件日志匹配用） */
    serverJobId: '',
    /** 插件搜索过滤词 */
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
    /** 挂载 web 服务日志监听（实现见 ./server） */
    attachServerLog() {
      attachServerLog(this)
    },

    /** 启动初始化：加载设置、列 profile、解析 dsh、加载第一个 profile */
    async init() {
      this.attachServerLog()
      await this.loadSettings()
      this.profiles = await dshApi.listProfiles()
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

    /** 从 KV 加载设置（dsh 路径 / 端口 / 重启询问） */
    async loadSettings() {
      const saved = await KeyValueUtil.getItem<Partial<AppSettings>>(LocalNameEnum.KEY_DSH_SETTINGS)
      this.settings = { ...defaultSettings, ...(saved ?? {}) }
    },

    /** 加载 profile 详情：合并 bundles + cordis.patch.yml 为插件列表 */
    async loadProfile(name: string) {
      this.loading = true
      try {
        const manifest = await dshApi.readProfileManifest(name)
        const bundles = manifest?.dsh?.profile?.bundles ?? []
        const dependencies = manifest?.dependencies ?? {}
        const patchText = await dshApi.readProfilePatch(name)
        const patches = parsePatchEntries(patchText)
        const disabledIds = new Set(
          patches.filter((p) => p.disabled === true).map((p) => p.id)
        )
        const items: BundleItem[] = []
        for (const bundleName of bundles) {
          items.push(
            await this.buildBundleItem(name, bundleName, dependencies[bundleName], disabledIds)
          )
        }
        this.detail = { name, bundles, patches, items }
        const thirdParty = items.filter((i) => !i.official)
        this.pureMode = thirdParty.length > 0 && thirdParty.every((i) => !i.enabled)
      } finally {
        this.loading = false
      }
    },

    async buildBundleItem(
      profile: string,
      bundleName: string,
      dependencySpec: string | undefined,
      disabledIds: Set<string>
    ): Promise<BundleItem> {
      const pkg = await dshApi.readInstalledPackage(profile, bundleName)
      const rows = await this.resolveBundleRows(profile, bundleName)
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
    async resolveBundleRows(profile: string, bundleName: string): Promise<BundleRowRef[]> {
      const patchText = await dshApi.readBundlePatch(profile, bundleName)
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
      void KeyValueUtil.setItem(LocalNameEnum.KEY_DSH_SETTINGS, { ...this.settings })
      await this.resolveDsh()
      if (this.dsh.state === 'ok') {
        // dsh 就绪后刷新 profile 详情
        if (this.currentProfile) await this.loadProfile(this.currentProfile)
      }
    },

    saveSettings(partial: Partial<AppSettings>) {
      this.settings = { ...this.settings, ...partial }
      void KeyValueUtil.setItem(LocalNameEnum.KEY_DSH_SETTINGS, { ...this.settings })
    },

    // ---- 启用 / 禁用 ----
    async toggleBundle(bundle: BundleItem, enabled: boolean) {
      if (!this.detail) return
      const rowIds = bundle.rows.map((row) => row.id)
      const patchText = dshApi.setRowsDisabled(
        await dshApi.readProfilePatch(this.currentProfile),
        rowIds,
        !enabled
      )
      await dshApi.writeProfilePatch(this.currentProfile, patchText)
      await this.loadProfile(this.currentProfile)
    },

    // ---- 纯净模式 ----
    async setPureMode(on: boolean) {
      if (!this.detail) return
      const thirdPartyRows = this.detail.items
        .filter((i) => !i.official)
        .flatMap((i) => i.rows.map((row) => row.id))
      const patchText = dshApi.setRowsDisabled(
        await dshApi.readProfilePatch(this.currentProfile),
        thirdPartyRows,
        on
      )
      await dshApi.writeProfilePatch(this.currentProfile, patchText)
      await this.loadProfile(this.currentProfile)
    },

    // ---- 插件 config ----
    /** 读取某行的 config 覆盖（profile patch 中） */
    async readPluginConfig(rowId: string): Promise<Record<string, unknown> | undefined> {
      return readPatchConfig(await dshApi.readProfilePatch(this.currentProfile), rowId)
    },

    /** 保存某行的 config 覆盖到 profile patch */
    async savePluginConfig(rowId: string, config: Record<string, unknown>) {
      const patchText = dshApi.setPatchConfigEntry(
        await dshApi.readProfilePatch(this.currentProfile),
        rowId,
        config
      )
      await dshApi.writeProfilePatch(this.currentProfile, patchText)
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

    /** 执行 dsh CLI 并流式回调输出（事件推送），返回退出码 */
    async runCli(args: string[], onOutput: (chunk: string) => void): Promise<number> {
      const runner = this.dshCommand()
      if (!runner) {
        onOutput('dsh not found — please configure the dsh executable first\n')
        return 1
      }
      this.cliBusy = true
      try {
        const jobId = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        return await dshApi.runCliStream(
          jobId,
          runner.command,
          [...runner.prefix, ...args],
          false,
          (_stream, text) => onOutput(text)
        )
      } finally {
        this.cliBusy = false
      }
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

    // ---- web 服务（启停 / 状态实现见 ./server）----
    async refreshServerStatus() {
      return refreshServerStatus(this)
    },

    async serverStart() {
      return startServer(this)
    },

    async serverStop() {
      return stopServer(this)
    },

    serverOpen() {
      openServer(this)
    },

    /** 重启 web 服务（仅对本管理器启动的服务生效），返回是否已重启 */
    async restartServer(): Promise<boolean> {
      return restartServer(this)
    }
  }
})

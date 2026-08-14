# 01 · DSH 插件管理器

Wails v3 桌面应用「DSH 插件管理器」的技术文档。按 profile 管理 dsh（DeepSeek Harness）的插件：启用 / 禁用、安装 / 更新 /
移除、纯净模式、启动 dsh web 服务、编辑插件 config。

技术栈：Go（后端服务绑定）+ Vue 3 / TDesign / Vite（前端，位于 `frontend/`），Wails v3 提供原生能力（对话框 / 剪贴板 /
打开外链 / 事件系统）。本应用为纯桌面形态， **与 utools 无任何关系**。

## 一、实现思路

- **插件本质是 npm 库**：每个 profile（`$DSH_HOME/profiles/<name>`）的 `package.json` 中 `dsh.profile.bundles` 是启用的
  bundle 顺序列表；`node_modules` 由 pnpm 管理（hoisted 到 `profiles/node_modules`）。
- **启用 / 禁用走 cordis patch**：profile 级 `cordis.patch.yml` 以「行 id」定位条目（不是包名），写
  `- id: <rowId>\n  disabled: true` 即可禁用。行 id 来自 bundle 自带 patch（`dsh.bundle.patch` 指向的文件）里的 `insert` 段。
- **安装 / 更新 / 移除复用官方 CLI**：`dsh plugin --profile <p> add|update|remove <spec|name>` 转发给 pnpm 并自动
  reconcile bundles，比手改 package.json 更稳。CLI 流式输出经事件通道推送前端。安装抽屉为直装形态：粘贴完整 spec（npm 包名 /
  `pkg@version` / `github:user/repo#branch`）即装，输出经 ANSI 解析渲染颜色；安装 / 更新均可一键取消（kill 进程），成功后若
  `profile=web` 且服务在运行则询问重启（复用 `restartServer`）。
- **web 服务**：`dsh --profile web --port <n>`（默认 3080，绑定 127.0.0.1），detached 后台启动。运行状态判定 = 记录的启动 PID
  存活 **或** lsof 端口监听者（不用 TCP 探测，避免系统代理劫持端口误报）。
- **dsh 缺失引导**：解析不到 dsh 可执行文件时进入全屏引导页 `/setup`：安装命令（`bun install -g @deepseek-ai/dsh` /
  `npm install -g @deepseek-ai/dsh`，可复制）+ 手动输入路径 + 系统文件选择框，`dsh --version` 校验后持久化。
- **无网络请求**：前端不做任何 HTTP 请求（不探测 npm registry / GitHub API，无搜索与版本检查能力）；一切数据来自本地 dsh CLI
  与磁盘文件。唯一例外是 Go 侧的应用自动更新检查（见下）。
- **应用自动更新**：利用 Wails v3 内置 `updater` 包（`endpoint` provider，Wails Update Manifest 协议）检查静态托管的
  `update.json`；每 6 小时后台静默检查（headless，不弹框架窗口），发现新版本自动下载并暂存，就绪后前端弹「立即重启 / 稍后」确认，确认后由
  helper 子进程完成二进制替换并重启。

## 二、架构与关键文件

```
/（仓库根）
├── main.go                  # Wails 入口：embed frontend/dist + 注册 4 个服务 + 窗口 + 应用自动更新（initUpdater）
├── tray.go                  # 系统托盘：显示/隐藏 / 启动停止服务 / 检查更新 / 退出（含关闭到托盘钩子）
├── services/
│   ├── dsh.go               # DshService：DSH_HOME / profile / patch / 可执行文件探测
│   ├── proc.go              # ProcService：流式子进程（事件推送）/ kill / isAlive / lsof
│   ├── kv.go                # KVService：应用级键值存储（JSON 文件）
│   ├── browser.go           # BrowserService：内置浏览器窗口（运行中动态建窗加载外部 URL）
│   └── tray.go              # TrayServiceStatus 事件负载类型（托盘状态契约）
├── config.yml               # Wails 项目配置（产品名 / 版本 / dev 模式）
├── Taskfile.yml             # 构建任务（wails3 驱动，pnpm 管理前端）
└── frontend/
    ├── bindings/            # wails3 generate bindings 自动生成（勿手改）
    └── src/                 # Vue 前端
```

### Go 服务（`services/`，为 `src-utools/src/*.js` 的翻译，行为保真）

| 服务             | 方法                                                                                                                                                                                  | 说明                                                                                                                                                                                                                                                       |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `DshService`     | `GetDshHome / ListProfiles / ReadProfileManifest / WriteProfileManifest / ReadProfilePatch / WriteProfilePatch / ReadBundlePatch / ReadInstalledPackage / ResolveDshBin / ResolveDsh` | dsh 生态文件访问；`ResolveDsh` 探测运行方式（直接执行 → bun 兜底）返回 `{state, command, prefix, version}`                                                                                                                                                 |
| `ProcService`    | `RunCli(jobId, cmd, args, detached) / Kill / IsAlive / FindPidByPort`                                                                                                                 | 流式子进程；输出经事件 `proc:output`、退出经 `proc:exit` 推送（按 jobId 分发）；`Kill` 为 SIGTERM → 3s → SIGKILL（Windows 为 TerminateProcess，平台差异在 `proc_unix.go` / `proc_windows.go` 按构建标签拆分）；`FindPidByPort` 走 lsof（win32 返回 null）  |
| `KVService`      | `GetItem / SetItem / RemoveItem`                                                                                                                                                      | 替代原 dbStorage：内存 map + 持久化到 `os.UserConfigDir()/dsh-plugin-manager/kv.json`（原子写）                                                                                                                                                            |
| `BrowserService` | `OpenInBuiltin(url, width, height)`                                                                                                                                                   | 内置浏览器：运行中 `application.Get().Window.NewWithOptions(WebviewWindowOptions{URL: url})` 动态建窗加载外部 URL（Wails v3 JS runtime 无建窗 API，只能在 Go 侧做）；窗口单例复用，已存在则按需 `SetURL` + `Focus`，`events.Common.WindowClosing` 时清引用 |

### 前端（`frontend/src/`）

| 文件                              | 职责                                                                                                                                                                                                                                                                                                                                                                                                                       |
|-----------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `api/dsh.ts`                      | 底层能力封装（RL-03）：服务绑定 + 事件式 CLI；`runCliStream` 等待退出返回码、`runCliInterruptible` 返回 `{pid, exit}` 可中途 `kill(pid)`（安装取消用），内部均 `Events.On("proc:output"/"proc:exit")` 按 jobId 分发并自动清理监听                                                                                                                                                                                          |
| `api/native.ts`                   | 原生能力适配层：`Dialogs.OpenFile`、`Clipboard.SetText`、`Browser.OpenURL`（系统默认浏览器开外链）、`browser.openInBuiltin`（内置浏览器窗口，经 BrowserService 绑定）、KV 转发；替代原 `window.preload.inject`                                                                                                                                                                                                             |
| `utils/dsh/patch.ts`              | cordis.patch.yml 解析 / 增删改 / 序列化（`yaml` 库 Document 级操作，保证注释与 `!!js` 表达式往返保真）                                                                                                                                                                                                                                                                                                                     |
| `utils/ansi.ts`                   | ANSI SGR 转 HTML（`ansiToHtml`）：终端 16 色 + 粗体 / 斜体 / 下划线等样式，文本 HTML 转义防 XSS；安装控制台渲染用                                                                                                                                                                                                                                                                                                          |
| `utils/native/KeyValueUtil.ts`    | KV 访问（async），设置 / 服务 PID / 主题 / 语言持久化                                                                                                                                                                                                                                                                                                                                                                      |
| `hooks/DbStorage.ts`              | 持久化 ref：内存态即时响应、异步落库（替代原 `UtoolsDbStorage`）                                                                                                                                                                                                                                                                                                                                                           |
| `store/dsh/index.ts`              | 全局 store：profiles / bundles / patch / dsh 解析 / 设置 / CLI 执行；web 服务启停经薄包装转发 `store/dsh/server.ts`                                                                                                                                                                                                                                                                                                        |
| `store/dsh/server.ts`             | dsh web 服务启停与状态（从主 store 拆分，控制行数）：`refreshServerStatus`（PID + lsof 判定）**保留 busy**、`serverStart/serverStop`（busy 互斥）、`restartServer` **全程持有 busy**（stop→start 无间隙，重启期间按钮持续禁用）、日志监听 `attachServerLog`；`openServer` 按 `settings.browserMode` 分流——builtin 走 `nativeApi.browser.openInBuiltin`（内置窗口），system 走 `nativeApi.shell.openExternal`（默认浏览器） |
| `hooks/UseTray.ts`                | 系统托盘桥接：watch `server.status` 回推 `tray:service-status`（恒 `supported: true`——profile 恒含 web 应用）；响应 `tray:toggle-service`（按状态调 serverStart/Stop）、`tray:quit-request`（先停服务再回 `tray:quit-ready`）                                                                                                                                                                                              |
| `hooks/UseUpdater.ts`             | 应用自动更新桥接：响应 `app:update-ready` 弹「立即重启 / 稍后」确认（tdesign 命令式 DialogPlugin），确认后回发 `app:update-restart`；托盘「检查更新」结果 `app:update-result` 以消息提示                                                                                                                                                                                                                                   |
| `pages/profile/index.vue`         | 首页：服务卡片（置顶）、header（profile 切换 + 搜索 + 安装）、官方 / 第三方分组（纯净模式开关位于第三方分组卡片头部 actions；设置入口在服务卡片行）                                                                                                                                                                                                                                                                        |
| `pages/profile/restart.ts`        | 插件变更后的重启提示（从 index.vue 拆分控制行数）：`promptRestart(action, name?)` 按服务状态 / `confirmRestart` 设置决定是否弹确认并调用 `restartServer`                                                                                                                                                                                                                                                                   |
| `pages/setup/index.vue`           | 全屏引导页：dsh 缺失时的安装命令 / 手动路径 / 文件选择 / 校验                                                                                                                                                                                                                                                                                                                                                              |
| `pages/redirect/RedirectHome.vue` | `/` 兜底重定向（dsh 未就绪 → `/setup`，否则 → 当前 profile 首页）                                                                                                                                                                                                                                                                                                                                                          |
| `pages/settings/index.vue`        | 设置页（`SubPageLayout` 返回）：dsh 路径 / 端口 / 浏览器打开方式（默认浏览器 or 内置浏览器 + 宽高，默认 1200×800）/ 主题 / 语言；浏览器方式与宽高走保存按钮（与 port 一致），主题 / 语言即时生效                                                                                                                                                                                                                           |
| `pages/profile/modals/`           | `InstallPlugin.tsx` / `UpdatePlugin.tsx` 共用 `InstallPluginContent.vue`（双模式直装 / 更新抽屉：可中断 CLI + ANSI 控制台 + web 重启询问，仅「取消」按钮可关闭）、`PluginConfig.tsx` + `PluginConfigContent.vue`（命令式弹窗，tsx 外壳 + vue 内容）                                                                                                                                                                        |
| `i18n/`                           | zh / en 字典 + `useI18n`（KV 异步加载语言）                                                                                                                                                                                                                                                                                                                                                                                |
| `hooks/ColorMode.ts`              | 亮 / 暗 / 跟随系统（`theme-mode` 属性切换 tdesign 暗色）                                                                                                                                                                                                                                                                                                                                                                   |
| `types/dsh.ts`                    | 领域类型：ProfileDetail / BundleItem / PatchEntry / ServerState 等                                                                                                                                                                                                                                                                                                                                                         |

## 三、事件协议（Go ⇄ 前端）

| 事件                  | 方向      | 负载（`services` 包结构）                                | 用途                                                                                                      |
|-----------------------|-----------|----------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| `proc:output`         | Go → 前端 | `ProcOutput { jobId, stream: "stdout"\|"stderr", text }` | CLI / web 服务流式输出                                                                                    |
| `proc:exit`           | Go → 前端 | `ProcExit { jobId, code }`                               | 进程退出（仅非 detached；web 服务长驻不触发）                                                             |
| `tray:toggle-service` | Go → 前端 | 无                                                       | 托盘"启动/停止服务"点击；前端按当前状态调 `serverStart` / `serverStop`                                    |
| `tray:service-status` | 前端 → Go | `TrayServiceStatus { running, supported }`               | 服务状态回推；Go 切换菜单标签（启动服务/停止服务）与禁用态（supported=false 置灰）                        |
| `tray:quit-request`   | Go → 前端 | 无                                                       | 托盘"退出"点击；请求前端先停服务                                                                          |
| `tray:quit-ready`     | 前端 → Go | 无                                                       | 前端停服务完成；Go 收到后真正退出（3 秒超时兜底强制退出）                                                 |
| `app:update-ready`    | Go → 前端 | 无                                                       | 应用更新已下载并暂存；前端弹「立即重启 / 稍后」确认（`main.go` 监听 `wails:updater:update-ready` 后转发） |
| `app:update-restart`  | 前端 → Go | 无                                                       | 用户确认重启；Go 调 `app.Updater.Restart`，helper 子进程在旧进程退出后完成二进制替换并重启                |
| `app:update-result`   | Go → 前端 | `{ status: "up-to-date" \| "error", message? }`          | 托盘「检查更新」的结果提示（有更新时走 `app:update-ready` 弹窗，不重复提示）                              |

约定：前端先 `Events.On` 注册监听、再调用 `ProcService.RunCli`（Go 侧收到调用后才 spawn，时序安全）；`jobId` 由前端生成（
`cli-<ts>-<rand>` / `server-<ts>`）隔离并发。

## 四、API 契约

### patch 条目（cordis.patch.yml 顶层数组）

```yaml
- id: better-sidebar        # 行 id（来自 bundle 自身 patch 的 insert）
  disabled: true            # 启用 / 禁用
  config: { ... }           # config 覆盖（JSON 编辑器操作这个）
```

注意：`!!js` 表达式（如 `port: !!js ctx.webStartup.port ?? 3080`）经 `yaml` 库可原样往返。

### BundleItem（前端合并视图）

`name / version / description / homepage / repository / official（@deepseek-ai/ 前缀）/ source（npm|github|local|unknown）/ rows（行 id 列表）/ enabled / hasUpdate / checking`

### 服务状态

`ServerState.status ∈ 'stopped' | 'running-own' | 'running-foreign' | 'unknown'`；记录键 `/key/dsh/server/<profile>` 存
`{ pid, port }`（KV 存储）。

### 设置（KV 存储，`os.UserConfigDir()/dsh-plugin-manager/kv.json`）

- `/key/dsh/settings` → `{ dshPath, port, confirmRestart, browserMode, builtinWidth, builtinHeight }`（port 默认
  3080；browserMode ∈ 'system' | 'builtin'，默认 'system'；内置窗口默认 1200×800）
- `/key/app/theme-mode` → `'light' | 'dark' | 'system'`
- `/key/app/lang` → `'zh' | 'en'`

## 五、注意事项 / 边界

1. **dsh 运行机制（重要）**：dsh 实际是 `~/.bun/bin/dsh` 指向的 JS 文件（shebang `#!/usr/bin/env node`）。Wails（macOS GUI
   应用）进程的 PATH 只是 launchd 基础路径，不含用户 shell 的 nvm / `~/.bun/bin` / homebrew 等，导致
   `env: node: No such file or directory`。处理：① `ProcService.resolveUserPath` 从登录 shell（`zsh -lic` / `bash -lic`
   ，缓存）提取完整 PATH 并注入所有 spawn；② `DshService.probeDsh` 探测运行方式——直接执行失败时用 `bun <dsh>` 兜底解释执行（bun
   兼容 node 脚本），`ResolveDsh` 返回 `command` + `prefix` 供后续组装命令。dsh 解析优先级：手动配置路径 > PATH >
   `~/.bun/bin/dsh`。
2. **只改 profile 级 `cordis.patch.yml`**；绝不触碰 `~/\.dsh/cordis.patch.yml`（dsh-skin 托管）与各 bundle 自带 patch。
3. **行 id ≠ 包名**：启用 / 禁用按行 id；解析不到 insert 时回退为包名（对单行注册的插件通常恰好相等）。
4. **官方插件（`@deepseek-ai/`）**：不可禁用 / 移除；纯净模式只操作第三方。
5. **纯净模式关闭**：删除所有第三方 bundle 的 `disabled` 键（会一并恢复手动禁用的第三方插件，UI 有文案提示）；仅剩 `id`
   的空覆盖行会整体移除，带 `config` 的行只删 `disabled` 保留 config。patch 写入统一为 block 风格（`- id: x` 缩进格式）。
6. **插件变更后的重启提示**：启用 / 禁用 / 卸载第三方插件、切换纯净模式（开启 / 关闭）后，若 web
   服务在运行（running-own）则询问「是否立即重启」（`restartServer` = stop + start）；服务未运行（stopped /
   unknown）则不打扰（纯净模式此时直接提示状态已变更）；外部启动（running-foreign）提示手动重启；设置项 `confirmRestart`（默认
   true）可关闭该询问。纯净模式为批量操作，确认文案走无插件名的 `restart.confirmPure` 模板（`profile/index.vue` 的
   `promptRestart` 按 action `'pure-on' | 'pure-off'` 区分）。安装 / 更新抽屉的 `maybeRestartWeb` 在 `profile === 'web'`
   且服务在运行（running-own）时同样询问重启（不受 `confirmRestart` 设置约束），foreign 直接提示手动重启。
7. **dsh plugin add / update 的 reconcile**：`add` 只会向 bundles 追加新包；`update` 直接执行 `dsh plugin update <name>`
   （无批量检查更新能力，前端不做 npm registry 版本探测）。
8. **端口探测不做运行判定**（代理劫持会误报），以 PID 存活 + lsof 监听者为准；`FindPidByPort` 在 win32 返回 null（外部启动的服务在
   win32 上显示 stopped，可接受）。
9. **git 源 bundle**（如 `github:omdsh-dev/dsh-at-file`）：安装时若 pnpm 阻止构建脚本，dsh 会提示在 `pnpm-workspace.yaml` 的
   allowBuilds 放行，UI 透传其 stderr。
10. **导航结构**：无侧边栏布局。`main.ts` bootstrap 先 `useColorMode()` 应用持久化主题（亮/暗/跟随系统，挂载前设置
    `theme-mode` 属性避免首屏白闪）、再 `await store.init()`、后挂载；App.vue 依据 dsh 状态统一路由——未就绪 → `/setup`
    全屏引导页，就绪 → 当前 profile 首页（`/profile/:name`）；首页 header 右侧按钮进入 `/settings`（SubPageLayout 返回）；`/` 由
    RedirectHome 兜底重定向。路由为 hash 模式。注意：`useColorMode()` 必须在 bootstrap
    调用（设置页的实例只在打开设置页时生效，启动时未调用会导致首屏永远亮色）。
11. **搜索过滤与 profile 刷新**：首页 header 的 profile 切换下拉右侧提供搜索输入框（`store.filter`），按插件名称 /
    描述实时过滤列表；无匹配时显示空态提示。profile 切换下拉（`t-select`）底部经 `panelBottomContent` 提供「刷新列表」按钮（
    `refreshProfiles`，带 loading / 成功失败提示）：调用 `store.refreshProfiles()` 重新执行 `dshApi.listProfiles()` 并处理
    currentProfile 失效——当前 profile 已不在列表时切到第一个（`selectProfile`），列表为空则清空 `currentProfile` 与
    `detail`（页面显示空态）。用途：外部（dsh CLI / web）新建 profile 后无需重启应用即可在下拉中看到。
12. **构建与验证**：`pnpm check`（vue-tsc typecheck，RL-07）+ `wails3 build`（产物 `bin/dsh-plugin-manager`）；开发模式
    `wails3 dev`（vite 热更新 + Go 热重载）。改动 Go 服务后需重跑 `wails3 generate bindings` 刷新前端绑定。
13. **系统托盘（菜单栏）**：托盘在 Go 侧构建（根目录 `tray.go`），左键点图标原生弹出菜单（不绑定
    AttachWindow/OnClick）；"显示/隐藏"纯原生（`win.Hide` / `win.Show().Focus()`）；"启动/停止服务"经事件路由到前端复用 store
    启停逻辑（Go 侧不重复实现），标签由前端回推的 `tray:service-status` 动态切换；"退出"发 `tray:quit-request`，前端
    `serverStop()` 后回 `tray:quit-ready`，3 秒超时兜底。 **关闭到托盘**：`win.RegisterHook(events.Common.WindowClosing)` 中
    `Cancel()` + `Hide()`——`Common.WindowClosing` 是各平台关闭事件默认映射的收敛点（macOS 红点/Cmd+W 的
    `Mac.WindowShouldClose`、Windows 关闭按钮的 `Windows.WindowClosing`、Linux WM 的 `Linux.WindowDeleteEvent`
    都映射到它），钩子先于默认销毁监听执行，窗口仅隐藏不销毁。 **不能只挂 `Mac.WindowShouldClose`**：Windows 上不触发，窗口会走默认销毁，随后
    `unregisterWindow` 因"最后一个窗口关闭"发 `PostQuitMessage(0)` 退出进程，托盘随之消失。配套选项（`main.go`）：
    `Mac.ApplicationShouldTerminateAfterLastWindowClosed=false`、`Mac.ActivationPolicy=ActivationPolicyAccessory`（菜单栏常驻、无
    Dock 图标——否则窗口关闭后 Dock 图标残留且点按无响应）、`Windows.DisableQuitOnLastWindowClosed=true`
    （兜底：窗口经其它路径被销毁时进程不随窗口退出）。程序化 `Close()`（当前无调用方）直接发 `Common.WindowClosing`，同样被钩子转为隐藏；
    `app.Quit()` 走 `impl.destroy` 不经此事件，不受影响。托盘图标为 `build/appicon.png`（彩色，可后续换 `SetTemplateIcon`
    模板图精修）。
14. **dev 模式的 `/wails/custom.js` 404**：Wails v3 开发模式（runtime.debug.js）启动时会探测 `/wails/custom.js`（server
    模式专用的 WebSocket 事件脚本），桌面模式下 Wails 故意返回 404 让 `loadOptionalScript` 跳过——DevTools console 里的
    `Failed to load resource: 404 (wails://.../wails/custom.js)` 是预期无害噪音，事件走原生 IPC
    不受影响；生产构建（runtime.prod.js）无此请求。
15. **安装 / 更新抽屉关闭约束**：`InstallPlugin.tsx` / `UpdatePlugin.tsx` 均配置
    `closeBtn: false / closeOnEscKeydown: false / closeOnOverlayClick: false`
    ，只能通过内容组件「取消」按钮关闭（运行中取消按钮禁用，只能点「取消安装 / 取消更新」= `kill(pid)` 终止进程，`Kill` 为
    SIGTERM → 3s → SIGKILL）；`InstallPluginContent.vue` 按 `mode` prop 区分 install / update：命令经 `store.dshCommand()`
    取 `{command, prefix}`，拼 `plugin --profile <p> add <spec>`（spec 含 `github:user/repo#branch` 原样透传）或
    `plugin --profile <p> update <name>`；`onBeforeUnmount` 兜底杀掉未结束进程（drawer `destroyOnClose` 销毁组件时）。
16. **内置浏览器窗口**：设置「浏览器打开方式」选内置浏览器后，首页服务卡片「打开」走 `store.openServer()` →
    `nativeApi.browser.openInBuiltin(url, 宽, 高)` → Go 侧 `BrowserService.OpenInBuiltin` 动态建窗加载
    `http://127.0.0.1:<port>`（标题 "DSH Web"）；选默认浏览器则仍走 `Browser.OpenURL`。窗口单例复用：重复点击只 `Focus`，URL
    变化才 `SetURL`（端口改动后自动刷新地址），关闭窗口后下次点击重建。注意：远程页面不会注入 wails runtime（纯浏览器用途，页面内无
    wails API 可用，符合预期）；Wails JS runtime 无建窗 API，此能力只能在 Go 侧实现。
17. **应用自动更新**：Wails v3 内置 `pkg/updater`（`app.Updater`）+ `providers/endpoint`（静态 URL 清单协议）。`main.go` 的
    `initUpdater` 配置：`CurrentVersion` 来自 **嵌入二进制并解析的 `build/config.yml` 的 `info.version`**（版本唯一来源，发布新版本只改
    config.yml，避免升级后版本号不更新导致重复提示更新）；`CheckInterval=6h` 后台周期检查；`Window=WindowNone` 走
    headless（周期检查不弹框架窗口）；`PublicKey` 为内嵌的 Ed25519 公钥（信任根）。`CheckAndInstall`
    （含托盘「检查更新」手动触发）发现新版本即自动下载 → 校验（digest / signature）→ 暂存（不覆盖运行中的二进制）→ 发
    `wails:updater:update-ready` → `app:update-ready` → 前端确认 → `app:update-restart` → `Restart()` 起 helper
    子进程，旧进程退出后替换二进制并重启。 **update.json 协议（schemaVersion≤1）**：
    `{ schemaVersion, version, channel?, name?, notes?, publishedAt?, artifacts: [{ url, filename?, filetype?, size?, platform?, arch?, digestAlgo?, digest?, signatureAlgo?, signature? }] }`；
    `version` 按 semver 与当前版本比较，需大于当前版本才会更新；`url` 可为相对路径（相对清单解析）。清单更新地址
    `updateManifestURL` 常量在 `main.go`，更新服务器 404/204 视为"无更新"。 **签名与发布流程**：`wails3 updater genkey`
    一次性生成 `updater.key`（私钥）+ `updater.key.pub`（公钥），两者均已 gitignore——私钥只保存在发布侧（CI secret / 密码管理器），
    **丢失后无法再签发新版本**；发布时 `wails3 updater sign -key updater.key <产物>` 计算产物 digest +
    signature（ed25519ph over SHA-512）→ `wails3 updater manifest -version <v> <产物目录>` 生成标准 manifest.json（内嵌
    base64 signature / digest）→ 将 manifest.json 与产物上传至 `updateManifestURL` 目录。带签名的清单安装为
    **fail-closed**：验签失败或应用未配置公钥时拒装。
18. **Windows spawn 黑窗口（CREATE_NO_WINDOW）**：Windows GUI 应用（本应用是 GUI 子系统进程）没有控制台，spawn
    控制台程序（node / bun / 经 cmd.exe 运行的 .cmd 等）时 Windows 会为其新建控制台窗口，必须带
    `SysProcAttr.CreationFlags = CREATE_NO_WINDOW (0x08000000)` 抑制，否则每次获取 dsh 版本、启动 web 服务、执行插件 CLI
    都会闪现黑窗口，且 **关掉黑窗口 = 杀掉子进程**（web 服务随之退出）。所有 spawn 统一经 `spawnProcAttr(detached)`（
    `proc_windows.go` 返回带该标志的属性；`proc_unix.go` 保持原行为：detached 时 `Setpgid: true`），`ProcService.RunCli` 与
    `DshService.runVersion` 都必须设置 `c.SysProcAttr = spawnProcAttr(...)`，新增 spawn 点同样要走此入口。

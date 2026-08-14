# 01 · DSH 插件管理器

Wails v3 桌面应用「DSH 插件管理器」的技术文档。按 profile 管理 dsh（DeepSeek Harness）的插件：启用 / 禁用、安装 / 移除、拖拽排序、纯净模式、启动 dsh web 服务、编辑插件 config、导出 / 导入 profile 视图、检查更新。

技术栈：Go（后端服务绑定）+ Vue 3 / TDesign / Vite（前端，位于 `frontend/`），Wails v3 提供原生能力（对话框 / 剪贴板 / 打开外链 / 事件系统）。本应用为纯桌面形态，**与 utools 无任何关系**。

## 一、实现思路

- **插件本质是 npm 库**：每个 profile（`$DSH_HOME/profiles/<name>`）的 `package.json` 中 `dsh.profile.bundles` 是启用的 bundle 顺序列表；`node_modules` 由 pnpm 管理（hoisted 到 `profiles/node_modules`）。
- **启用 / 禁用走 cordis patch**：profile 级 `cordis.patch.yml` 以「行 id」定位条目（不是包名），写 `- id: <rowId>\n  disabled: true` 即可禁用。行 id 来自 bundle 自带 patch（`dsh.bundle.patch` 指向的文件）里的 `insert` 段。
- **安装 / 移除复用官方 CLI**：`dsh plugin --profile <p> add|remove <spec>` 转发给 pnpm 并自动 reconcile bundles，比手改 package.json 更稳。CLI 流式输出经事件通道推送前端。
- **web 服务**：`dsh --profile web --port <n>`（默认 3080，绑定 127.0.0.1），detached 后台启动。运行状态判定 = 记录的启动 PID 存活 **或** lsof 端口监听者（不用 TCP 探测，避免系统代理劫持端口误报）。
- **dsh 缺失引导**：解析不到 dsh 可执行文件时进入全屏引导页 `/setup`：安装命令（`bun install -g @deepseek-ai/dsh` / `npm install -g @deepseek-ai/dsh`，可复制）+ 手动输入路径 + 系统文件选择框，`dsh --version` 校验后持久化。
- **网络请求走浏览器 fetch**：npm registry / GitHub API 均允许跨域，Wails 前端运行在本地 asset server 无 CORS 限制，因此搜索 / 查版本直接前端 fetch（封装 15s AbortController 超时），不再经过 Go 层。

## 二、架构与关键文件

```
/（仓库根）
├── main.go                  # Wails 入口：embed frontend/dist + 注册 4 个服务 + 窗口
├── services/
│   ├── dsh.go               # DshService：DSH_HOME / profile / patch / 可执行文件探测
│   ├── proc.go              # ProcService：流式子进程（事件推送）/ kill / isAlive / lsof
│   ├── file.go              # FileService：通用文件读写
│   └── kv.go                # KVService：应用级键值存储（JSON 文件）
├── config.yml               # Wails 项目配置（产品名 / 版本 / dev 模式）
├── Taskfile.yml             # 构建任务（wails3 驱动，pnpm 管理前端）
└── frontend/
    ├── bindings/            # wails3 generate bindings 自动生成（勿手改）
    └── src/                 # Vue 前端
```

### Go 服务（`services/`，为 `src-utools/src/*.js` 的翻译，行为保真）
| 服务 | 方法 | 说明 |
|---|---|---|
| `DshService` | `GetDshHome / ListProfiles / ReadProfileManifest / WriteProfileManifest / ReadProfilePatch / WriteProfilePatch / ReadBundlePatch / ReadInstalledPackage / ResolveDshBin / ResolveDsh` | dsh 生态文件访问；`ResolveDsh` 探测运行方式（直接执行 → bun 兜底）返回 `{state, command, prefix, version}` |
| `ProcService` | `RunCli(jobId, cmd, args, detached) / Kill / IsAlive / FindPidByPort` | 流式子进程；输出经事件 `proc:output`、退出经 `proc:exit` 推送（按 jobId 分发）；`Kill` 为 SIGTERM → 3s → SIGKILL；`FindPidByPort` 走 lsof（win32 返回 null） |
| `FileService` | `ReadTextFile / WriteTextFile` | 导出 / 导入 JSON |
| `KVService` | `GetItem / SetItem / RemoveItem` | 替代原 dbStorage：内存 map + 持久化到 `os.UserConfigDir()/dsh-plugin-manager/kv.json`（原子写） |

### 前端（`frontend/src/`）
| 文件 | 职责 |
|---|---|
| `api/dsh.ts` | 底层能力封装（RL-03）：服务绑定 + fetch + 事件式 CLI；`runCliStream(jobId, cmd, args, detached, onOutput)` 内部 `Events.On("proc:output"/"proc:exit")` 按 jobId 分发并自动清理监听 |
| `api/native.ts` | 原生能力适配层：`Dialogs.OpenFile/SaveFile`、`Clipboard.SetText`、`Browser.OpenURL`、KV 转发；替代原 `window.preload.inject` |
| `utils/dsh/patch.ts` | cordis.patch.yml 解析 / 增删改 / 序列化（`yaml` 库 Document 级操作，保证注释与 `!!js` 表达式往返保真） |
| `utils/native/KeyValueUtil.ts` | KV 访问（async），设置 / 服务 PID / 主题 / 语言持久化 |
| `hooks/DbStorage.ts` | 持久化 ref：内存态即时响应、异步落库（替代原 `UtoolsDbStorage`） |
| `store/dsh/index.ts` | 全局 store：profiles / bundles / patch / dsh 解析 / 服务 / 设置 / CLI 执行；`attachServerLog` 经 `proc:output` 事件按 `serverJobId` 累积 web 服务日志（logTail） |
| `pages/profile/index.vue` | 首页：header（profile 切换 + 设置入口 + 搜索）、服务卡片、工具栏、官方 / 第三方分组、拖拽排序 |
| `pages/setup/index.vue` | 全屏引导页：dsh 缺失时的安装命令 / 手动路径 / 文件选择 / 校验 |
| `pages/redirect/RedirectHome.vue` | `/` 兜底重定向（dsh 未就绪 → `/setup`，否则 → 当前 profile 首页） |
| `pages/settings/index.vue` | 设置页（`SubPageLayout` 返回）：dsh 路径 / 端口 / 主题 / 语言 |
| `pages/profile/modals/` | `InstallPlugin.tsx` + `InstallPluginContent.vue`、`PluginConfig.tsx` + `PluginConfigContent.vue`、`ImportProfile.tsx` + `ImportProfileContent.vue`（命令式弹窗，tsx 外壳 + vue 内容） |
| `i18n/` | zh / en 字典 + `useI18n`（KV 异步加载语言） |
| `hooks/ColorMode.ts` | 亮 / 暗 / 跟随系统（`theme-mode` 属性切换 tdesign 暗色） |
| `types/dsh.ts` | 领域类型：ProfileDetail / BundleItem / PatchEntry / ServerState 等 |

## 三、事件协议（Go → 前端）

| 事件 | 负载（`services` 包结构） | 用途 |
|---|---|---|
| `proc:output` | `ProcOutput { jobId, stream: "stdout"\|"stderr", text }` | CLI / web 服务流式输出 |
| `proc:exit` | `ProcExit { jobId, code }` | 进程退出（仅非 detached；web 服务长驻不触发） |

约定：前端先 `Events.On` 注册监听、再调用 `ProcService.RunCli`（Go 侧收到调用后才 spawn，时序安全）；`jobId` 由前端生成（`cli-<ts>-<rand>` / `server-<ts>`）隔离并发。

## 四、API 契约

### patch 条目（cordis.patch.yml 顶层数组）
```yaml
- id: better-sidebar        # 行 id（来自 bundle 自身 patch 的 insert）
  disabled: true            # 启用 / 禁用
  config: { ... }           # config 覆盖（JSON 编辑器操作这个）
```
注意：`!!js` 表达式（如 `port: !!js ctx.webStartup.port ?? 3080`）经 `yaml` 库可原样往返；**导出再导入会丢失 `!!js` 标记**（序列化为纯字符串）。

### BundleItem（前端合并视图）
`name / version / description / homepage / repository / official（@deepseek-ai/ 前缀）/ source（npm|github|local|unknown）/ rows（行 id 列表）/ enabled / hasUpdate / checking`

### 服务状态
`ServerState.status ∈ 'stopped' | 'running-own' | 'running-foreign' | 'unknown'`；记录键 `/key/dsh/server/<profile>` 存 `{ pid, port }`（KV 存储）。

### 设置（KV 存储，`os.UserConfigDir()/dsh-plugin-manager/kv.json`）
- `/key/dsh/settings` → `{ dshPath, port, confirmRestart }`（port 默认 3080）
- `/key/app/theme-mode` → `'light' | 'dark' | 'system'`
- `/key/app/lang` → `'zh' | 'en'`

### 导出 / 导入文件结构（JSON）
```json
{ "profile": "web", "bundles": ["..."], "patches": [{ "id": "...", "disabled": true }], "exportedAt": "..." }
```

## 五、注意事项 / 边界

1. **dsh 运行机制（重要）**：dsh 实际是 `~/.bun/bin/dsh` 指向的 JS 文件（shebang `#!/usr/bin/env node`）。Wails（macOS GUI 应用）进程的 PATH 只是 launchd 基础路径，不含用户 shell 的 nvm / `~/.bun/bin` / homebrew 等，导致 `env: node: No such file or directory`。处理：① `ProcService.resolveUserPath` 从登录 shell（`zsh -lic` / `bash -lic`，缓存）提取完整 PATH 并注入所有 spawn；② `DshService.probeDsh` 探测运行方式——直接执行失败时用 `bun <dsh>` 兜底解释执行（bun 兼容 node 脚本），`ResolveDsh` 返回 `command` + `prefix` 供后续组装命令。dsh 解析优先级：手动配置路径 > PATH > `~/.bun/bin/dsh`。
2. **只改 profile 级 `cordis.patch.yml`**；绝不触碰 `~/\.dsh/cordis.patch.yml`（dsh-skin 托管）与各 bundle 自带 patch。
3. **行 id ≠ 包名**：启用 / 禁用按行 id；解析不到 insert 时回退为包名（对单行注册的插件通常恰好相等）。
4. **官方插件（`@deepseek-ai/`）**：不可禁用 / 移除；纯净模式只操作第三方。
5. **纯净模式关闭**：删除所有第三方 bundle 的 `disabled` 键（会一并恢复手动禁用的第三方插件，UI 有文案提示）；仅剩 `id` 的空覆盖行会整体移除，带 `config` 的行只删 `disabled` 保留 config。patch 写入统一为 block 风格（`- id: x` 缩进格式）。
6. **插件变更后的重启提示**：启用 / 禁用 / 卸载第三方插件后，若 web 服务在运行（running-own）则询问「是否立即重启」（`restartServer` = stop + start）；服务未运行则不打扰；外部启动（running-foreign）提示手动重启；设置项 `confirmRestart`（默认 true）可关闭该询问。
7. **dsh plugin add 的 reconcile**：只会向 bundles 追加新包，不会打乱拖拽排序；`update` 通过 `dsh plugin add <pkg>@latest` 实现。
8. **端口探测不做运行判定**（代理劫持会误报），以 PID 存活 + lsof 监听者为准；`FindPidByPort` 在 win32 返回 null（外部启动的服务在 win32 上显示 stopped，可接受）。
9. **git 源 bundle**（如 `github:omdsh-dev/dsh-at-file`）：检查更新跳过（无 registry 版本）；安装时若 pnpm 阻止构建脚本，dsh 会提示在 `pnpm-workspace.yaml` 的 allowBuilds 放行，UI 透传其 stderr。
10. **导航结构**：无侧边栏布局。`main.ts` bootstrap 先 `await store.init()` 再挂载；App.vue 依据 dsh 状态统一路由——未就绪 → `/setup` 全屏引导页，就绪 → 当前 profile 首页（`/profile/:name`）；首页 header 右侧按钮进入 `/settings`（SubPageLayout 返回）；`/` 由 RedirectHome 兜底重定向。路由为 hash 模式。
11. **搜索过滤**：首页 header 的 profile 切换下拉右侧提供搜索输入框（`store.filter`），按插件名称 / 描述实时过滤列表；无匹配时显示空态提示。
12. **构建与验证**：`pnpm check`（vue-tsc typecheck，RL-07）+ `wails3 build`（产物 `bin/dsh-plugin-manager`）；开发模式 `wails3 dev`（vite 热更新 + Go 热重载）。改动 Go 服务后需重跑 `wails3 generate bindings` 刷新前端绑定。

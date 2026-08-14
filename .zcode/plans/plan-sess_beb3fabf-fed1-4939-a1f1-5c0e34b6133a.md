# dsh-plugin-manager 迁移为 Wails v3 桌面应用

## 目标
把当前 utools 插件（Vue3 前端 `src/` + Node preload 壳 `src-utools/`）迁移为 Wails v3 应用，彻底移除 utools 依赖。前端页面/状态/patch 逻辑几乎全部复用，核心工作是把 `src-utools/src/` 的 5 个 Node 模块翻译成 Go 服务，并替换 `window.preload` 适配层。

## 目标架构（Wails v3 标准结构）
```
/  (仓库根)
├── main.go              # go:embed frontend/dist + application.New + 注册服务
├── services/
│   ├── dsh.go           # 翻译 dsh.js（DSH_HOME/profile/patch/可执行文件探测）
│   ├── proc.go          # 翻译 process.js（RunCli 事件式、kill、isAlive、findPidByPort、PATH 注入）
│   ├── file.go          # 翻译 file.js（readTextFile/writeTextFile）
│   └── kv.go            # 替代 dbStorage：JSON 文件 KV（os.UserConfigDir() 下）
├── config.yml           # v3 项目配置（替代 wails.json）
├── Taskfile.yml         # build/dev 任务（wails3 驱动）
├── go.mod / go.sum
├── build/               # 打包图标等资源（从 wails3 模板拷贝）
└── frontend/            # ← 现有前端整体 git mv 到此
    ├── src/  package.json  vite.config.ts  tsconfig*.json  uno.config.ts  index.html  public/  ...
    ├── bindings/        # wails3 generate bindings 生成的服务 TS 绑定（强类型，符合 RL-03）
    └── dist/            # 构建产物
```
删除：`src-utools/`、`skill-utools-dev/`、`tsconfig.utools.json`。

## 一、Go 后端（4 个服务，全部标准库）

**DshService**（dsh.go）：逐函数翻译 dsh.js —— `GetDshHome/ListProfiles/ReadProfileManifest/WriteProfileManifest/ReadProfilePatch/WriteProfilePatch/ReadBundlePatch/ReadInstalledPackage/ResolveDshBin/ResolveDsh`。保真要点：
- `resolveDshBin`：手动路径 > 进程 PATH 查找 > `~/.bun/bin/dsh`（保持原逻辑）
- `probeDsh`：直接执行 `dsh --version`（10s 超时，注入用户 PATH）→ 失败用 `bun <binPath> --version` 兜底，返回 `{state, command, prefix, version, error}`

**ProcService**（proc.go）：
- `resolveUserPath`：`/bin/zsh -lic` → `/bin/bash -lic` 执行 `echo $PATH` 取最后一行（带超时），缓存；win32 直接用进程 PATH
- `RunCli(jobId, cmd, args)`：异步 goroutine 启动子进程，stdout/stderr 块经 `app.Event.Emit("proc:output", {jobId, stream, text})` 推送，退出时 Emit `"proc:exit", {jobId, code}`，立即返回；**detached 参数**支持 web 服务后台启动（Setpgid + Process.Release）
- `Kill(pid)`：SIGTERM → 3s 未退 SIGKILL（保真原逻辑）
- `IsAlive(pid)`：signal 0 探测
- `FindPidByPort(port)`：`lsof -ti tcp:<port> -sTCP:LISTEN`（win32 返回 nil）

**FileService**（file.go）：`ReadTextFile/WriteTextFile`（薄封装）。

**KVService**（kv.go）：内存 map + 锁，持久化到 `os.UserConfigDir()/dsh-plugin-manager/kv.json`（原子写：tmp + rename）。`GetItem/SetItem/RemoveItem`，键沿用现有枚举（`/key/dsh/settings`、`/key/dsh/server/<profile>`、`/key/app/theme-mode`、`/key/app/lang`）。

对话框/剪贴板/打开外链不用 Go 胶水，前端直接用 `@wailsio/runtime` 的 `Dialogs/Clipboard/Browser`。

## 二、前端改造（改动集中在适配层）

1. **git mv** 前端文件到 `frontend/`；调整 vite.config.ts（`base: "/"`、outDir 默认 dist）；路由保留 hash 模式（router.ts 零改动）。
2. **依赖**：删除 `utools-api-types`、`@ztools-center/ztools-api-types`、`axios`（经确认未使用）；新增 `@wailsio/runtime`。
3. **新增 `src/api/native.ts`**：统一封装 runtime API —— `dialog.open/save`（`Dialogs.OpenFile/SaveFile`，async）、`clipboard.copyText`（`Clipboard.SetText`）、`shell.openExternal`（`Browser.OpenURL`）、KV 转发到 KVService。所有组件/store 一律经此访问（符合 RL-03）。
4. **`src/api/dsh.ts`**：
   - `window.preload.dsh.*` → 从 `frontend/bindings/` 导入的服务方法（或 `Call.ByName`）
   - `net.*` → 直接浏览器 `fetch`（npm registry / GitHub API 均允许跨域，封装 15s AbortController 超时；`searchNpm/fetchLatestVersion/searchGithub` 对外签名不变）
   - `spawnStream` 改造为事件式 `runCli`：内部 `Events.On("proc:output"/"proc:exit")` 按 jobId 分发 → 调 `RunCli` → 等 done 事件 → 清理监听（先 On 后 Call，无竞态）
5. **`src/utils/native/KeyValueUtil.ts`**：`window.preload.inject.dbStorage` → KVService 调用（签名不变）。
6. **`src/vite-env.d.ts`** 删除 `Window.preload` 声明（类型改由 `bindings/` 与 `native.ts` 提供）；删除 `src/types/inject.d.ts`。
7. **store（src/store/dsh/index.ts）**：`runCli` 改用事件式封装；`exportProfile` 改 async（await dialog.save）；`serverOpen` 改 `Browser.OpenURL`；`serverStart/serverStop` 改用 `SpawnDetached`/`Kill`，日志经事件累积 logTail；`refreshServerStatus` 用 `IsAlive/FindPidByPort` 绑定。
8. **页面调用点**（4 处，改为 await 的 native 封装）：`setup/index.vue`（选文件、复制命令）、`settings/index.vue`（选 dsh 文件）、`profile/index.vue`（打开插件主页）、`profile/modals/ImportProfileContent.vue`（选导入文件）。
9. **`src/main.ts`**：按 wails3 模板模式初始化 runtime（照 `wails3 init` 生成模板补 `@wailsio/runtime` 初始化）。

## 三、窗口与应用配置
- `application.Options`：Name 为 `DSH Plugin Manager`，默认窗口约 1080×760、可调整（替代 utools 固定 640 高度）。
- macOS 上 GUI 进程 PATH 不含用户 shell 路径 —— `resolveUserPath` 注入逻辑必须保留（nvm/`~/.bun/bin`/homebrew 场景）。

## 四、文档同步（RL-06）
- 重写 `docs/01-plugin-manager.md` 为 Wails 架构版（Go 服务契约、事件协议、保真行为清单）；同步更新 `docs/README.md` 索引。
- 更新根 `README.md`（移除 utools 说明）。
- AGENTS.md 现有前端规范仍适用，无需大改。

## 五、实施步骤与验证
1. 检查环境：`go version`、`wails3 version`（缺则 `go install github.com/wailsapp/wails/v3/cmd/wails3@latest`）。
2. 用 `wails3 init` 生成参考模板（临时目录），拷贝 config.yml / Taskfile.yml / build/ 结构并改造。
3. git mv 前端 → frontend/，调整配置、依赖、类型。
4. 编写 4 个 Go 服务 + main.go，`wails3 generate bindings` 生成前端绑定。
5. 改造前端适配层（native.ts / dsh.ts / KeyValueUtil / store / 页面调用点）。
6. 删除 utools 相关文件与依赖。
7. 验证：`pnpm typecheck`（RL-07 要求，无需 build）+ `wails3 build` 成功；`wails3 dev` 手动冒烟（引导页 → 校验 dsh → 插件列表 → 服务启停）。

## 风险与保真注意
- 流式 CLI 日志事件化后的时序（先注册监听再发起调用，jobId 隔离并发）
- detached 服务进程在 Wails 退出后的行为与原 utools 一致（pipe 断流后子进程 EPIPE，行为保真）
- `resolveDshBin` 用进程 PATH + `~/.bun/bin` 兜底的原逻辑保持一致，不做隐性改进
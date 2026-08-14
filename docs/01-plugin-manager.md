# 01 · DSH 插件管理器

uTools 插件「DSH 插件管理器」的技术文档。按 profile 管理 dsh（DeepSeek Harness）的插件：启用 / 禁用、安装 / 移除、拖拽排序、纯净模式、启动 dsh web 服务、编辑插件 config、导出 / 导入 profile 视图、检查更新。

## 一、实现思路

- **插件本质是 npm 库**：每个 profile（`$DSH_HOME/profiles/<name>`）的 `package.json` 中 `dsh.profile.bundles` 是启用的 bundle 顺序列表；`node_modules` 由 pnpm 管理（hoisted 到 `profiles/node_modules`）。
- **启用 / 禁用走 cordis patch**：profile 级 `cordis.patch.yml` 以「行 id」定位条目（不是包名），写 `- id: <rowId>\n  disabled: true` 即可禁用。行 id 来自 bundle 自带 patch（`dsh.bundle.patch` 指向的文件）里的 `insert` 段。
- **安装 / 移除复用官方 CLI**：`dsh plugin --profile <p> add|remove <spec>` 转发给 pnpm 并自动 reconcile bundles，比手改 package.json 更稳。
- **web 服务**：`dsh --profile web --port <n>`（默认 3080，绑定 127.0.0.1）。运行状态判定 = 记录的启动 PID 存活 **或** lsof 端口监听者（不用 TCP 探测，避免系统代理劫持端口误报）。
- **dsh 缺失引导**：解析不到 dsh 可执行文件时，页面顶部显示横幅：安装命令（`bun install -g @deepseek-ai/dsh` / `npm install -g @deepseek-ai/dsh`）+ 手动输入路径 + `inject.dialog.open` 选择文件，`dsh --version` 校验后持久化。

## 二、关键文件

### preload（Node 侧，`src-utools/src/`）
| 文件 | 职责 |
|---|---|
| `dsh.js` | DSH_HOME 解析（`$DSH_HOME` → `~/\.dsh`）、profiles 列表、package.json / cordis.patch.yml 读写、bundle patch 读取、已装包版本、dsh 路径解析（手动路径 → PATH → `~/.bun/bin`）、运行方式探测（直接执行 / bun 兜底） |
| `process.js` | `spawnStream`（流式子进程，自动注入用户登录 shell 的完整 PATH）、`kill`（SIGTERM→SIGKILL）、`isAlive`、`checkPort`（TCP 探测）、`findPidByPort`（lsof）、`resolveUserPath`（zsh/bash 登录 shell 提取 PATH） |
| `net.js` | 新增 `httpJson`：http/https 请求、跟随重定向、超时、JSON 解析（npm registry / GitHub API） |
| `file.js` | 通用文件读写（导出 / 导入） |
| `preload.js` | 挂载 `window.preload = { getPlatform, net, inject, dsh, proc, file }` |

### 前端（`src/`）
| 文件 | 职责 |
|---|---|
| `api/dsh.ts` | 底层能力封装（RL-03），组件 / store 一律经此访问 |
| `utils/dsh/patch.ts` | cordis.patch.yml 解析 / 增删改 / 序列化（`yaml` 库 Document 级操作，保证注释与 `!!js` 表达式往返保真） |
| `store/dsh/index.ts` | 全局 store：profiles / bundles / patch / dsh 解析 / 服务 / 设置 / CLI 执行 |
| `pages/profile/index.vue` | 首页：header（profile 切换 + 设置入口）、服务卡片、工具栏、官方 / 第三方分组、拖拽排序、子输入框过滤 |
| `pages/setup/index.vue` | 全屏引导页：dsh 缺失时的安装命令 / 手动路径 / 文件选择 / 校验，成功后进入首页 |
| `pages/redirect/RedirectHome.vue` | `/` 兜底重定向（dsh 未就绪 → `/setup`，否则 → 当前 profile 首页） |
| `pages/settings/index.vue` | 设置页（`SubPageLayout` 返回）：dsh 路径 / 端口 / 主题 / 语言 |
| `pages/profile/components/` | `ServerCard.vue`、`PluginCard.vue`、`PluginGroup.vue` |
| `pages/profile/modals/` | `InstallPlugin.tsx` + `InstallPluginContent.vue`、`PluginConfig.tsx` + `PluginConfigContent.vue`、`ImportProfile.tsx` + `ImportProfileContent.vue`（命令式弹窗，tsx 外壳 + vue 内容） |
| `pages/settings/index.vue` | 设置：dsh 路径 / 端口 / 主题 / 语言 |
| `i18n/` | zh / en 字典 + `useI18n`（dbStorage 持久化） |
| `hooks/ColorMode.ts` | 亮 / 暗 / 跟随系统（`theme-mode` 属性切换 tdesign 暗色） |
| `types/dsh.ts` | 领域类型：ProfileDetail / BundleItem / PatchEntry / ServerState 等 |

## 三、API 契约

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
`ServerState.status ∈ 'stopped' | 'running-own' | 'running-foreign' | 'unknown'`；记录键 `/key/dsh/server/<profile>` 存 `{ pid, port }`（dbStorage）。

### 设置（dbStorage）
- `/key/dsh/settings` → `{ dshPath, port }`（port 默认 3080）
- `/key/app/theme-mode` → `'light' | 'dark' | 'system'`
- `/key/app/lang` → `'zh' | 'en'`

### 导出 / 导入文件结构（JSON）
```json
{ "profile": "web", "bundles": ["..."], "patches": [{ "id": "...", "disabled": true }], "exportedAt": "..." }
```

## 四、注意事项 / 边界

1. **dsh 运行机制（重要）**：dsh 实际是 `~/.bun/bin/dsh` 指向的 JS 文件（shebang `#!/usr/bin/env node`）。utools（macOS GUI 应用）进程的 PATH 只是 launchd 基础路径，不含用户 shell 的 nvm / `~/.bun/bin` / homebrew 等，导致 `env: node: No such file or directory`。处理：① `process.js` 从登录 shell（`zsh -lic` / `bash -lic`，缓存）提取完整 PATH 并注入所有 spawn；② `dsh.js` 的 `probeDsh` 探测运行方式——直接执行失败时用 `bun <dsh>` 兜底解释执行（bun 兼容 node 脚本），`resolveDsh` 返回 `command` + `prefix` 供后续调用组装命令。dsh 解析优先级：手动配置路径 > PATH > `~/.bun/bin/dsh`（mac 用 bun 安装的默认位置）。
2. **只改 profile 级 `cordis.patch.yml`**；绝不触碰 `~/\.dsh/cordis.patch.yml`（dsh-skin 托管）与各 bundle 自带 patch。
3. **行 id ≠ 包名**：启用 / 禁用按行 id；解析不到 insert 时回退为包名（对单行注册的插件通常恰好相等）。
4. **官方插件（`@deepseek-ai/`）**：不可禁用 / 移除；纯净模式只操作第三方。
5. **纯净模式关闭**：删除所有第三方 bundle 的 `disabled` 键（会一并恢复手动禁用的第三方插件，UI 有文案提示）；仅剩 `id` 的空覆盖行会整体移除，带 `config` 的行只删 `disabled` 保留 config。patch 写入统一为 block 风格（`- id: x` 缩进格式）。
6. **插件变更后的重启提示**：启用 / 禁用 / 卸载第三方插件后，若 web 服务在运行（running-own）则询问「是否立即重启」（`restartServer` = stop + start）；服务未运行则不打扰；外部启动（running-foreign）提示手动重启；设置项 `confirmRestart`（默认 true）可关闭该询问（设置 → 插件变更后询问是否重启服务）。
6. **dsh plugin add 的 reconcile**：只会向 bundles 追加新包，不会打乱拖拽排序；`update` 通过 `dsh plugin add <pkg>@latest` 实现。
7. **端口探测不做运行判定**（代理劫持会误报），以 PID 存活 + lsof 监听者为准；`findPidByPort` 在 win32 返回 null（外部启动的服务在 win32 上显示 stopped，可接受）。
8. **git 源 bundle**（如 `github:omdsh-dev/dsh-at-file`）：检查更新跳过（无 registry 版本）；安装时若 pnpm 阻止构建脚本，dsh 会提示在 `pnpm-workspace.yaml` 的 allowBuilds 放行，UI 透传其 stderr。
9. **导航结构**：无侧边栏布局。`main.ts` bootstrap 先 `await store.init()` 再挂载；App.vue 依据 dsh 状态统一路由——未就绪 → `/setup` 全屏引导页，就绪 → 当前 profile 首页（`/profile/:name`）；首页 header 右侧按钮进入 `/settings`（SubPageLayout 返回）；`/` 由 RedirectHome 兜底重定向。
10. **子输入框**：首页挂载时 `setSubInput` 过滤插件列表，离开页面 `removeSubInput`；`onPluginEnter` 的输入文本作为初始过滤词。
11. **验证**：只做 typecheck（`pnpm check`），不需要 build（RL-07）。

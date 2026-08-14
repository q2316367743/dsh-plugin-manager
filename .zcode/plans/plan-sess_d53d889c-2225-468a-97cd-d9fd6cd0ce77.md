## 调研结论：可行 ✅

Wails v3.0.0-beta.8 **支持在运行中动态创建新窗口并加载外部 URL**，但只能在 **Go 侧**实现（前端 JS runtime 只有 `Hide/Show/Quit`，无建窗 API）：

- Go 侧 `application.Get().Window.NewWithOptions(application.WebviewWindowOptions{URL: "http://127.0.0.1:<port>"})` 可在应用运行中随时建窗（`runOrDeferToAppRun` 已确认线程安全）
- darwin 原生层直接按原始 URL 加载，不拦截外部导航；窗口创建后自动显示
- 远程页面不会自动注入 wails runtime（纯浏览器用途，符合预期）
- 已确认 `Focus()` / `SetTitle()` / `SetURL()` / `events.Common.WindowClosing` 均可用

现有"打开"链路：`ServerCard.vue` → `store.openServer()` → `nativeApi.shell.openExternal(url)` → `Browser.OpenURL`（系统默认浏览器）。方案就是在它前面按设置分流。

## 实现方案

### 1. Go 侧：新增 `services/browser.go`（BrowserService）
```go
type BrowserService struct {
    mu      sync.Mutex
    builtin *application.WebviewWindow // 内置浏览器窗口单例
}

// OpenInBuiltin：在内置浏览器窗口中打开 url；窗口已存在则聚焦复用
func (s *BrowserService) OpenInBuiltin(url string, width, height int)
```
- 单例复用策略：重复点击「打开」不叠加窗口，聚焦已有窗口；窗口关闭时（监听 `events.Common.WindowClosing`）清空引用，下次点击重新创建
- 创建：`application.Get().Window.NewWithOptions(WebviewWindowOptions{Title: "DSH Web", Width: width, Height: height, URL: url})`

### 2. `main.go`：注册 `application.NewService(services.NewBrowserService())`

### 3. 重跑 `wails3 generate bindings -ts -i` 刷新 `frontend/bindings/`（AGENTS.md 约定）

### 4. 前端类型与默认值
- `frontend/src/types/dsh.ts`：新增 `type BrowserOpenMode = 'system' | 'builtin'`；`AppSettings` 增加 `browserMode: BrowserOpenMode`、`builtinWidth: number`、`builtinHeight: number`
- `frontend/src/store/dsh/index.ts`：`defaultSettings` 补 `{ browserMode: 'system', builtinWidth: 1200, builtinHeight: 800 }`

### 5. 前端 API：`frontend/src/api/native.ts` 增加
```ts
browser: {
  openInBuiltin: async (url: string, width: number, height: number) => {
    await BrowserService.OpenInBuiltin(url, width, height)
  }
}
```

### 6. 设置页：`frontend/src/pages/settings/index.vue`（88→约 105 行，仍在 300 行内）
- 在「web 服务端口」后新增 `t-form-item`「浏览器打开方式」：`t-radio-group` + 两个 `t-radio-button`（默认浏览器 / 内置浏览器）
- `v-if="browserMode === 'builtin'"` 条件显示「内置浏览器窗口尺寸」：宽/高两个 `t-input-number`（`min=200, max=7680`），默认 1200×800
- `save()` 中并入 `store.saveSettings({ ..., browserMode, builtinWidth, builtinHeight })`（与其他手动保存项一致，走保存按钮）

### 7. 消费点：`frontend/src/store/dsh/server.ts` 的 `openServer()`
```ts
const url = `http://127.0.0.1:${store.settings.port}`
if (store.settings.browserMode === 'builtin') {
  void nativeApi.browser.openInBuiltin(url, store.settings.builtinWidth, store.settings.builtinHeight)
} else {
  void nativeApi.shell.openExternal(url)
}
```

### 8. i18n：`frontend/src/i18n/zh.ts` + `en.ts` 新增
`settings.browserMode`（浏览器打开方式）、`settings.browserSystem`（默认浏览器）、`settings.browserBuiltin`（内置浏览器）、`settings.builtinSize`（内置浏览器窗口尺寸）

### 9. 文档同步（RL-06）
更新 `docs/01-plugin-manager.md`（新增 BrowserService 契约与 AppSettings 新字段、设置项说明）及 `docs/README.md` 索引描述

### 10. 验证
- `pnpm check`（vue-tsc typecheck，RL-07，不 build）
- `go build ./...` 确保 Go 侧编译通过（运行时行为由用户自测，与既有约定一致）

## 涉及文件
| 文件 | 改动 |
|---|---|
| `services/browser.go` | 新增 BrowserService |
| `main.go` | 注册新服务 |
| `frontend/bindings/` | 重新生成 |
| `frontend/src/types/dsh.ts` | AppSettings 扩展 |
| `frontend/src/store/dsh/index.ts` | 默认值 |
| `frontend/src/api/native.ts` | browser.openInBuiltin |
| `frontend/src/pages/settings/index.vue` | 设置项 UI |
| `frontend/src/store/dsh/server.ts` | openServer 分流 |
| `frontend/src/i18n/zh.ts` / `en.ts` | 文案 |
| `docs/01-plugin-manager.md`、`docs/README.md` | 文档同步 |
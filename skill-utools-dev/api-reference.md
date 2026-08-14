# window.preload.inject API 完整参考

> 本文档是 `preload.js` → `inject.js` 暴露给前端的所有 API 的完整参考。
> 所有 API 通过 `window.preload.inject.xxx` 调用。
> inject 封装层屏蔽了 utools / ZTools / browser 的底层差异。

---

## 平台检测

### `getPlatform()`

返回当前运行平台。

```ts
getPlatform(): 'ZTools' | 'utools' | 'browser'
```

| 返回值 | 说明 |
|--------|------|
| `'utools'` | uTools 官方客户端 |
| `'ZTools'` | 飞书版 uTools（API 兼容） |
| `'browser'` | 浏览器环境 |

---

## 事件钩子

### `onPluginEnter(callback)`

用户进入插件时触发。**这是处理功能指令的入口。**

```ts
onPluginEnter(callback: (action: {
  code: string           // feature.code，区分不同功能
  type: string           // 触发类型: 'text' | 'img' | 'files' | 'regex' | 'over' | 'window'
  payload: any           // 用户输入/选择的实际数据
  option: any            // 匹配指令相关选项
  from?: 'main' | 'panel' | 'hotkey' | 'redirect'  // 进入方式
}) => void): void
```

**示例**：
```ts
window.preload.inject.onPluginEnter(({ code, type, payload }) => {
  if (code === 'my-feature') {
    // payload 内容取决于 type：
    // 'text' → string
    // 'files' → { isFile, isDirectory, name, path }[]
    // 'img' → base64 string
  }
})
```

### `onPluginOut(callback)`

插件退出/隐藏时触发。

```ts
onPluginOut(callback: (processExit: boolean) => void): void
```

- `processExit = true`：插件进程结束
- `processExit = false`：插件被隐藏到后台

### `onPluginDetach(callback)`

用户将插件分离为独立窗口时触发。

```ts
onPluginDetach(callback: () => void): void
```

### `onDbPull(callback)`

当数据从云端同步到本地时触发（需运行中）。

```ts
onDbPull(callback: (docs: { _id: string; _rev?: string; value: any }[]) => void): void
```

### `onMainPush(callback, selectCallback)`

向搜索框推送内容，并处理用户选择。

```ts
onMainPush(
  callback: (action: { code: string; type: string; payload: any }) =>
    { icon?: string; text: string; title?: string }[],
  selectCallback: (action: {
    code: string; type: string; payload: any
    option: { icon?: string; text: string; title?: string }
  }) => void
): void
```

> 需要 `plugin.json` 中对应 feature 设置 `"mainPush": true`

---

## 窗口控制

### `window.hideMainWindow(isRestorePreWindow?)`

隐藏主窗口。

```ts
hideMainWindow(isRestorePreWindow?: boolean): boolean
```

### `window.showMainWindow()`

显示主窗口。

```ts
showMainWindow(): boolean
```

### `window.setExpendHeight(height)`

动态设置窗口高度。

```ts
setExpendHeight(height: number): boolean
```

### `window.getWindowType()`

获取当前窗口类型。

```ts
getWindowType(): 'main' | 'detach' | 'browser'
```

### `window.hideMainWindowTypeString(str)`

隐藏主窗口并将文本输入到系统窗口。

```ts
hideMainWindowTypeString(str: string): void
```

### `window.hideMainWindowPasteText(text)`

隐藏主窗口并粘贴文本。

```ts
hideMainWindowPasteText(text: string): void
```

### `window.hideMainWindowPasteFile(file)`

隐藏主窗口并粘贴文件。

```ts
hideMainWindowPasteFile(file: string | string[]): void
```

### `window.hideMainWindowPasteImage(img)`

隐藏主窗口并粘贴图片。

```ts
hideMainWindowPasteImage(img: string | Uint8Array): void
```

### `window.startDrag(file)`

开始拖拽文件。

```ts
startDrag(file: string | string[]): void
```

---

## 系统 Shell

### `shell.openExternal(url)`

用系统默认浏览器打开 URL。

```ts
openExternal(url: string): void
```

### `shell.openPath(fullPath)`

用系统默认程序打开文件/文件夹。

```ts
openPath(fullPath: string): void
```

### `shell.trashItem(filename)`

移动文件到废纸篓。

```ts
trashItem(filename: string): Promise<void>
```

### `shell.showItemInFolder(fullPath)`

在文件管理器中定位并选中文件。

```ts
showItemInFolder(fullPath: string): void
```

### `shell.beep()`

播放系统提示音。

```ts
beep(): void
```

---

## 文件对话框

### `dialog.open(options?)`

打开文件选择对话框。

```ts
open(options?: {
  title?: string
  defaultPath?: string
  buttonLabel?: string
  filters?: { name: string; extensions: string[] }[]
  properties?: Array<
    | 'openFile' | 'openDirectory' | 'multiSelections'
    | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate'
    | 'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent'
  >
  message?: string
  securityScopedBookmarks?: boolean
}): string[] | undefined
```

### `dialog.save(options?)`

打开保存文件对话框。

```ts
save(options?: {
  title?: string
  defaultPath?: string
  buttonLabel?: string
  filters?: { name: string; extensions: string[] }[]
  message?: string
  nameFieldLabel?: string
  properties?: Array<
    | 'showHiddenFiles' | 'createDirectory'
    | 'treatPackageAsDirectory' | 'showOverwriteConfirmation' | 'dontAddToRecent'
  >
  securityScopedBookmarks?: boolean
}): string | undefined
```

---

## 剪贴板

### `clipboard.copyText(text)`

复制文本到剪贴板。

```ts
copyText(text: string): boolean
```

### `clipboard.copyFile(file)`

复制文件到剪贴板。

```ts
copyFile(file: string | string[]): boolean
```

### `clipboard.copyImage(img)`

复制图片到剪贴板。

```ts
copyImage(img: string | Uint8Array): boolean
```

### `clipboard.getCopyedFiles()`

获取当前已复制的文件列表。

```ts
getCopyedFiles(): { isFile: boolean; isDirectory: boolean; name: string; path: string }[]
```

---

## 系统信息

### `os.isDarkColors()`

系统是否使用暗色模式。

```ts
isDarkColors(): boolean
```

### `os.isMacOS()` / `os.isWindows()` / `os.isLinux()`

平台判断。

```ts
isMacOS(): boolean
isWindows(): boolean
isLinux(): boolean
```

### `os.isDev()`

当前是否为开发调试模式。

```ts
isDev(): boolean
```

### `os.getUser()`

获取当前登录用户信息（ZTools 下返回 null）。

```ts
getUser(): { avatar: string; nickname: string; type: string } | null
```

### `os.getNativeId()`

获取设备唯一标识。

```ts
getNativeId(): string
```

### `os.getAppVersion()`

获取 uTools 版本号。

```ts
getAppVersion(): string
```

### `os.getAppName()`

获取应用名称。

```ts
getAppName(): string
```

### `os.getPath(name)`

获取系统标准目录路径。

```ts
getPath(name:
  | 'home' | 'appData' | 'userData' | 'cache' | 'temp'
  | 'exe' | 'module' | 'desktop' | 'documents' | 'downloads'
  | 'music' | 'pictures' | 'videos' | 'logs' | 'pepperFlashSystemPlugin'
): string
```

### `os.getFileIcon(filePath)`

获取文件的系统图标（base64）。

```ts
getFileIcon(filePath: string): string
```

### `os.getCursorScreenPoint()`

获取光标屏幕坐标。

```ts
getCursorScreenPoint(): { x: number; y: number }
```

---

## 显示器

### `display.getPrimaryDisplay()`

获取主显示器信息。

```ts
getPrimaryDisplay(): {
  id: number; internal: boolean; rotation: number; scaleFactor: number
  size: { width: number; height: number }
  workArea: { width: number; height: number }
  workAreaSize: { width: number; height: number }
  bounds: { x: number; y: number; width: number; height: number }
  // ... 更多字段
}
```

### `display.getAllDisplays()`

获取所有显示器信息。返回数组。

### `display.getCursorScreenPoint()` → 同 `os.getCursorScreenPoint()`

### `display.desktopCaptureSources(options)`

获取桌面/窗口截图源。

```ts
desktopCaptureSources(options: {
  types: string[]
  thumbnailSize?: { width: number; height: number }
  fetchWindowIcons?: boolean
}): Promise<{
  appIcon: any; display_id: string; id: string; name: string; thumbnail: any
}>
```

### 坐标转换

```ts
screenToDipPoint(point: {x,y}): {x,y}    // 屏幕坐标 → DIP
dipToScreenPoint(point: {x,y}): {x,y}    // DIP → 屏幕坐标
screenToDipRect(rect): {x,y,w,h}
dipToScreenRect(rect): {x,y,w,h}
```

---

## 浏览器窗口

### `browser.createBrowserWindow(url, options, callback?)`

创建独立浏览器窗口。

```ts
createBrowserWindow(url: string, options: {
  title?: string; width?: number; height?: number
  x?: number; y?: number
  minWidth?: number; minHeight?: number
  maxWidth?: number; maxHeight?: number
  resizable?: boolean; movable?: boolean
  minimizable?: boolean; maximizable?: boolean; closable?: boolean
  alwaysOnTop?: boolean; fullscreen?: boolean; fullscreenable?: boolean
  skipTaskbar?: boolean; frame?: boolean; transparent?: boolean
  backgroundColor?: string; hasShadow?: boolean
  titleBarStyle?: 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover'
  thickFrame?: boolean; vibrancy?: string; zoomToPageWidth?: boolean
  webPreferences?: {
    preload?: string; nodeIntegration?: boolean
    contextIsolation?: boolean; enableRemoteModule?: boolean
  }
}, callback?: () => void): {
  id: number
  close(): void; focus(): void; blur(): void
  isFocused(): boolean; isDestroyed(): boolean
  show(): void; hide(): void
  setSize(w, h): void; setPosition(x, y): void
  reload(): void; loadURL(url: string): void
  on(event: string, callback: Function): void
}
```

### `browser.sendToParent(channel, ...params)`

向父窗口发送消息。

```ts
sendToParent(channel: string, ...params: any[]): void
```

### `browser.findInPage(text, options?)`

页面内搜索。

```ts
findInPage(text: string, options?: {
  forward?: boolean; findNext?: boolean
  matchCase?: boolean; wordStart?: boolean; medialCapitalAsWordStart?: boolean
}): void
```

### `browser.stopFindInPage(action)`

停止页面内搜索。

```ts
stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void
```

---

## 子输入框

### `input.setSubInput(onChange, placeholder?, isFocus?)`

在主窗口下方显示子输入框。

```ts
setSubInput(
  onChange: (input: { text: string }) => void,
  placeholder?: string,
  isFocus?: boolean
): boolean
```

### `input.removeSubInput()`

移除子输入框。

```ts
removeSubInput(): boolean
```

### `input.setSubInputValue(value)`

设置子输入框的值。

```ts
setSubInputValue(value: string): boolean
```

### `input.subInputFocus()` / `subInputSelect()` / `subInputBlur()`

```ts
subInputFocus(): boolean    // 聚焦
subInputSelect(): boolean   // 全选
subInputBlur(): boolean     // 失焦
```

---

## 模拟按键

### `simulate.keyboardTap(key, ...modifier)`

模拟键盘按键。

```ts
keyboardTap(key: string, ...modifier: (
  'control' | 'ctrl' | 'shift' | 'option' | 'alt' | 'command' | 'super'
)[]): void
```

### 鼠标模拟

```ts
mouseClick(x?: number, y?: number): void
mouseRightClick(x?: number, y?: number): void
mouseDoubleClick(x?: number, y?: number): void
mouseMove(x: number, y: number): void
```

---

## 通知

### `notification.show(body, featureName?)`

弹出系统通知。

```ts
show(body: string, featureName?: string): void
```

---

## 动态指令

### `feature.set(feature)`

动态注册功能指令（运行时添加）。

```ts
set(feature: {
  code: string; explain?: string
  platform?: 'darwin' | 'win32' | 'linux' | Array<'darwin' | 'win32' | 'linux'>
  icon?: string
  cmds: (string | { type: 'img' | 'files' | 'regex' | 'over' | 'window'; label: string })[]
  mainHide?: boolean; mainPush?: boolean
}): boolean
```

### `feature.remove(code)`

移除动态指令。

```ts
remove(code: string): boolean
```

### `feature.get(codes?)`

获取已注册的功能指令。

```ts
get(codes?: string[]): InjectPluginFeature[]
```

---

## 屏幕操作

### `screen.colorPick(callback)`

取色器。

```ts
colorPick(callback: (color: { hex: string; rgb: string }) => void): void
```

### `screen.capture(callback)`

截图。

```ts
capture(callback: (imgBase64: string) => void): void
```

---

## 重定向

### `redirect.to(label, payload)`

跳转到其他插件。

```ts
redirect.to(
  label: string | string[],    // 目标插件的指令
  payload: string | { type: 'text' | 'img' | 'files'; data: any }
): boolean
```

### `redirect.hotKeySetting(cmdLabel, autocopy?)`

打开快捷键设置页面。

```ts
hotKeySetting(cmdLabel: string, autocopy?: boolean): void
```

### `redirect.aiModelsSetting()`

打开 AI 模型设置页面。

```ts
aiModelsSetting(): void
```

---

## 用户付费

### `purchase.open(options, callback?)`

打开购买页面。

```ts
open(options: { goodsId: string; outOrderId?: string; attach?: string }, callback?: () => void): void
```

### `purchase.pay(options, callback?)`

发起支付。

```ts
pay(options: { goodsId: string; outOrderId?: string; attach?: string }, callback?: () => void): void
```

### `purchase.getPayments()`

获取已支付订单。

```ts
getPayments(): Promise<{
  order_id: string; total_fee: number; body: string
  attach: string; goods_id: string; out_order_id: string; paid_at: string
}[]>
```

### `purchase.isPurchased()` / `purchase.getServerToken()`

```ts
isPurchased(): boolean
getServerToken(): Promise<{ token: string; expiredAt: number }>
```

---

## AI

### `ai.allModels()`

获取可用 AI 模型列表。

```ts
allModels(): Promise<{ id: string; label: string; description: string; icon: string; cost: number }[]>
```

### `ai.chat(option, streamCallback?)` 🔥

调用 AI 对话（支持流式）。

```ts
// 流式调用（推荐）
chat(
  option: {
    model?: string
    messages: { role: 'system' | 'user' | 'assistant'; content?: string; reasoning_content?: string }[]
    tools?: { type: 'function'; function: { name: string; description: string; parameters: any; required?: string[] } }[]
  },
  streamCallback: (chunk: { role: 'system' | 'user' | 'assistant'; content?: string; reasoning_content?: string }) => void
): { abort(): void } & Promise<void>

// 非流式调用
chat(option): Promise<{ role: string; content?: string }>
```

**示例（流式）**：
```ts
window.preload.inject.ai.chat(
  {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: '介绍一下 TypeScript' }]
  },
  (chunk) => {
    // chunk.content 逐块到达
    appendToDisplay(chunk.content || '')
  }
)
```

---

## FFmpeg

### `ffmpeg.run(args, onProgress?)`

调用 FFmpeg。

```ts
run(
  args: string[],
  onProgress?: (progress: {
    bitrate: string; fps: number; frame: number
    percent?: number; q: number | string
    size: string; speed: string; time: string
  }) => void
): { kill(): void; quit(): void } & Promise<void>
```

---

## 数据库 (db)

### `db` — 同步文档数据库（类 PouchDB）

```ts
db.put(doc: { _id: string; _rev?: string; [key: string]: any }): { id: string; rev?: string; ok?: boolean; error?: boolean; message?: string }
db.get<T>(id: string): { _id: string; _rev?: string; [key: string]: any } & T | null
db.remove(doc: string | { _id: string; _rev: string }): { id: string; rev?: string; ok?: boolean; error?: boolean; message?: string }
db.bulkDocs(docs: { _id: string; _rev?: string }[]): { id: string; rev?: string }[]
db.allDocs<T>(key?: string): ({ _id: string; _rev?: string } & T)[]
db.postAttachment(docId: string, attachment: Uint8Array, type: string): any
db.getAttachment(docId: string): Uint8Array | null
db.getAttachmentType(docId: string): string | null
db.replicateStateFromCloud(): null | 0 | 1
```

### `db.promises` — 异步 Promise 版本

与 `db` 方法一一对应，返回 Promise：

```ts
db.promises.put(doc): Promise<{ id: string; rev?: string }>
db.promises.get<T>(id: string): Promise<({ _id: string; _rev?: string } & T) | null>
db.promises.remove(doc): Promise<{ id: string; rev?: string }>
db.promises.bulkDocs(docs): Promise<{ id: string; rev?: string }[]>
db.promises.allDocs<T>(key?): Promise<({ _id: string; _rev?: string } & T)[]>
db.promises.postAttachment(docId, attachment, type): Promise<any>
db.promises.getAttachment(docId): Promise<Uint8Array | null>
db.promises.getAttachmentType(docId): Promise<string | null>
db.promises.replicateStateFromCloud(): Promise<null | 0 | 1>
```

---

## KV 存储

### `dbStorage` — 键值存储（类 localStorage）

```ts
dbStorage.setItem(key: string, value: any): void
dbStorage.getItem<T = any>(key: string): T
dbStorage.removeItem(key: string): void
```

> 前端推荐使用封装好的 `useUtoolsDbStorage` / `useUtoolsKvStorage` hook

### `dbCryptoStorage` — 加密键值存储

API 与 `dbStorage` 完全一致，但数据加密存储。

```ts
dbCryptoStorage.setItem(key: string, value: any): void
dbCryptoStorage.getItem<T = any>(key: string): T
dbCryptoStorage.removeItem(key: string): void
```

---

## 团队版

### `team.info()`

获取当前团队信息。

```ts
team.info(): {
  teamId: string; teamName: string; teamLogo: string
  userId: string; userName: string; userAvatar: string
}
```

### `team.preset(key)`

获取团队预设配置。

```ts
team.preset<T = any>(key: string): T
```

### `team.allPresets()`

获取所有团队预设。

```ts
team.allPresets(): Promise<{ key: string; value: any }[]>
```

---

## 其他工具方法

### `outPlugin(isKill?)`

退出当前插件。

```ts
outPlugin(isKill?: boolean): boolean
```

### `readCurrentFolderPath()`

读取文件管理器中当前打开的文件夹路径。

```ts
readCurrentFolderPath(): Promise<string>
```

### `readCurrentBrowserUrl()`

读取浏览器当前页面的 URL。

```ts
readCurrentBrowserUrl(): Promise<string>
```

---

## Preload 层自定义模块

### `net` — Node.js 网络能力

通过 `window.preload.net` 访问（非 inject，在 preload.js 层）。

```ts
window.preload.net.downloadFileFromUrl(url: string, path: string): Promise<void>
window.preload.net.pathToHref(path: string): string
```

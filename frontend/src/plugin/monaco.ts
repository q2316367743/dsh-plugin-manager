/**
 * monaco-editor worker 环境配置：唯一负责设置 MonacoEnvironment 的模块，
 * 在 main.ts 中副作用导入，确保任何编辑器组件挂载前 worker 已就绪。
 * - json.worker：JSON 语言实时校验（错误标记）
 * - 其余（yaml 等基础语言）走 editor.worker；语法高亮随主入口注册
 *
 * 注意：monaco-editor 0.56 的 exports 字段把所有子路径映射到 esm/vs/*.js，
 * 子路径导入不能带 `esm/vs` 前缀（会映射到不存在的路径），`min/` 目录亦不可导入；
 * 编辑器样式由各 ESM 文件内联的 .css 导入提供，无需也不可引入 editor.main.css。
 */
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import { nativeApi } from '@/api/native'

/**
 * WebView（WKWebView / WebView2）下 navigator.clipboard 受权限限制：
 * monaco 检测到 WebKit 后会装 Safari 剪贴板 workaround，在每次点击 / 按键时
 * 触发一次空 ClipboardItem 写入，被拒后反复抛 NotAllowedError（并产生 Canceled
 * 的未处理拒绝）。此处将 navigator.clipboard 替换为走 Wails 原生剪贴板的实现
 * （RL-03：原生能力经 @/api/native），须在 monaco 初始化前生效。
 */
function patchClipboard() {
  const shim: Clipboard = Object.create(navigator.clipboard)
  shim.write = async (items: ClipboardItems) => {
    // Safari workaround 的 write 携带待完成 ClipboardItem：文本在后续 writeText
    // 时 resolve；提取后写入原生剪贴板。promise 被新点击取消（monaco 内部
    // Canceled）时静默忽略。
    try {
      const blob = await items[0]?.getType('text/plain')
      const text = await blob?.text()
      if (text) await nativeApi.clipboard.copyText(text)
    } catch {
      // ignore canceled pending write
    }
  }
  shim.writeText = async (text: string) => {
    await nativeApi.clipboard.copyText(text)
  }
  shim.readText = async () => {
    return nativeApi.clipboard.readText()
  }
  shim.read = async () => {
    return []
  }
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: shim })
}
patchClipboard()

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new JsonWorker()
    return new EditorWorker()
  }
}

export { monaco }

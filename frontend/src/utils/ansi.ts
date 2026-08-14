/**
 * ANSI SGR（\x1b[...m）转 HTML 工具：用于控制台输出颜色渲染。
 * 支持终端基础样式与 16 色（dsh / bun CLI 输出常用），未知序列安全忽略。
 * 文本一律 HTML 转义，防 XSS。
 */

/** 前景色（30-37 / 90-97），ANSI 终端语义色 */
const ANSI_FG: Record<number, string> = {
  30: '#1f1f1f',
  31: '#c62828',
  32: '#2e7d32',
  33: '#b58900',
  34: '#1565c0',
  35: '#8e24aa',
  36: '#00838f',
  37: '#4a4a4a',
  90: '#666666',
  91: '#e53935',
  92: '#43a047',
  93: '#fbc02d',
  94: '#1e88e5',
  95: '#d81b60',
  96: '#00acc1',
  97: '#d0d0d0'
}

/** 背景色（40-47 / 100-107） */
const ANSI_BG: Record<number, string> = {
  40: '#1f1f1f',
  41: '#c62828',
  42: '#2e7d32',
  43: '#b58900',
  44: '#1565c0',
  45: '#8e24aa',
  46: '#00838f',
  47: '#4a4a4a',
  100: '#666666',
  101: '#e53935',
  102: '#43a047',
  103: '#fbc02d',
  104: '#1e88e5',
  105: '#d81b60',
  106: '#00acc1',
  107: '#d0d0d0'
}

interface AnsiStyle {
  color?: string
  bg?: string
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
}

function resetStyle(style: AnsiStyle): void {
  style.color = undefined
  style.bg = undefined
  style.bold = false
  style.italic = false
  style.underline = false
  style.strike = false
}

function applySgr(style: AnsiStyle, params: string): void {
  if (!params) {
    resetStyle(style)
    return
  }
  for (const raw of params.split(';')) {
    const code = Number(raw)
    switch (code) {
      case 0:
        resetStyle(style)
        break
      case 1:
        style.bold = true
        break
      case 3:
        style.italic = true
        break
      case 4:
        style.underline = true
        break
      case 9:
        style.strike = true
        break
      case 22:
        style.bold = false
        break
      case 23:
        style.italic = false
        break
      case 24:
        style.underline = false
        break
      case 29:
        style.strike = false
        break
      default:
        if (ANSI_FG[code]) style.color = ANSI_FG[code]
        else if (ANSI_BG[code]) style.bg = ANSI_BG[code]
      // 38;5;n / 48;5;n 256 色及其他未知序列：忽略
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function styledSpan(text: string, style: AnsiStyle): string {
  if (!text) return ''
  const parts: string[] = []
  if (style.color) parts.push(`color:${style.color}`)
  if (style.bg) parts.push(`background-color:${style.bg}`)
  if (style.bold) parts.push('font-weight:700')
  if (style.italic) parts.push('font-style:italic')
  const decorations: string[] = []
  if (style.underline) decorations.push('underline')
  if (style.strike) decorations.push('line-through')
  if (decorations.length) parts.push(`text-decoration:${decorations.join(' ')}`)
  const textHtml = escapeHtml(text)
  return parts.length ? `<span style="${parts.join(';')}">${textHtml}</span>` : textHtml
}

/** 将含 ANSI 转义序列的文本转为带内联样式的 HTML（文本已转义，可安全用于 v-html） */
export function ansiToHtml(input: string): string {
  const sgrRe = /\x1b\[([0-9;]*)m/g
  const style: AnsiStyle = { bold: false, italic: false, underline: false, strike: false }
  let html = ''
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = sgrRe.exec(input)) !== null) {
    if (match.index > lastIndex) {
      html += styledSpan(input.slice(lastIndex, match.index), style)
    }
    applySgr(style, match[1])
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < input.length) {
    html += styledSpan(input.slice(lastIndex), style)
  }
  return html
}

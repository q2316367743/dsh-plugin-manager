/**
 * 轻量 i18n：zh/en 字典 + 全局语言状态（KV 存储持久化）。
 */
import { computed, reactive, readonly } from 'vue'
import { KeyValueUtil } from '@/utils/native'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { zh } from './zh'
import type { I18nKey } from './zh'
import { en } from './en'

export type { I18nKey } from './zh'
export type Lang = 'zh' | 'en'

const dicts: Record<Lang, Record<I18nKey, string>> = { zh, en }

const state = reactive<{ lang: Lang }>({ lang: 'zh' })

// 异步加载持久化语言（KV 服务为异步接口）
void KeyValueUtil.getItem<Lang>(LocalNameEnum.KEY_APP_LANG).then((stored) => {
  state.lang = stored === 'en' ? 'en' : 'zh'
})

export function useI18n() {
  /** 取文案，{key} 占位符替换 */
  function t(key: I18nKey, params?: Record<string, string | number>): string {
    let text = dicts[state.lang][key] ?? zh[key] ?? key
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value))
      }
    }
    return text
  }

  function setLang(lang: Lang) {
    state.lang = lang
    void KeyValueUtil.setItem(LocalNameEnum.KEY_APP_LANG, lang)
  }

  return {
    lang: readonly(computed(() => state.lang)),
    setLang,
    t
  }
}

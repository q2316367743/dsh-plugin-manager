import type { ThemeMode } from '@/types/dsh'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { useUtoolsDbStorage } from './UtoolsDbStorage'

/**
 * 颜色模式：亮 / 暗 / 跟随系统，持久化到 dbStorage。
 * 通过 document.documentElement 的 theme-mode 属性切换 tdesign 暗色。
 */
export function useColorMode() {
  const mode = useUtoolsDbStorage<ThemeMode>(LocalNameEnum.KEY_APP_THEME_MODE, 'system')
  const isDark = ref(false)

  function apply() {
    const dark =
      mode.value === 'dark' ||
      (mode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    isDark.value = dark
    document.documentElement.setAttribute('theme-mode', dark ? 'dark' : 'light')
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    if (mode.value === 'system') apply()
  })

  watch(mode, apply)
  apply()

  function setMode(next: ThemeMode) {
    mode.value = next
  }

  return { isDark, mode, setMode }
}

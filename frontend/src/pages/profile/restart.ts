/**
 * 插件变更后的重启提示（从 profile/index.vue 拆分，控制文件行数）。
 */
import { useDshStore } from '@/store/dsh'
import { useI18n } from '@/i18n'
import type { I18nKey } from '@/i18n'
import MessageUtil from '@/utils/modal/MessageUtil'
import MessageBoxUtil from '@/utils/modal/MessageBoxUtil'

export type RestartAction = 'enabled' | 'disabled' | 'removed' | 'pure-on' | 'pure-off'

/**
 * 启用 / 禁用 / 卸载 / 切换纯净模式后，若 web 服务在运行则询问是否立即重启。
 * 设置中关闭「不再提示」后静默跳过；外部启动的服务提示手动重启。
 */
export async function promptRestart(action: RestartAction, name?: string) {
  const store = useDshStore()
  const { t } = useI18n()
  const status = store.server.status
  if (status === 'stopped' || status === 'unknown') return
  if (!store.settings.confirmRestart) return
  if (status === 'running-foreign') {
    MessageUtil.info(t('restart.foreign'))
    return
  }
  const actionKey: Record<RestartAction, I18nKey> = {
    enabled: 'restart.actionEnabled',
    disabled: 'restart.actionDisabled',
    removed: 'restart.actionRemoved',
    'pure-on': 'restart.actionPureOn',
    'pure-off': 'restart.actionPureOff'
  }
  const actionText = actionKey[action]
  const isPure = action === 'pure-on' || action === 'pure-off'
  let restart = false
  try {
    await MessageBoxUtil.confirm(
      isPure
        ? t('restart.confirmPure', { action: t(actionText) })
        : t('restart.confirm', { action: t(actionText), name: name ?? '' }),
      t('restart.title'),
      {
        confirmButtonText: t('restart.now'),
        cancelButtonText: t('restart.later')
      }
    )
    restart = true
  } catch {
    /* 用户选择稍后 */
  }
  if (!restart) {
    MessageUtil.info(t('restart.deferred'))
    return
  }
  MessageUtil.info(t('restart.restarting'))
  await store.restartServer()
  MessageUtil.success(t('restart.done'))
}

/**
 * 应用自动更新桥接：更新下载并暂存就绪（app:update-ready）后弹重启确认，
 * 用户确认则回发 app:update-restart 触发 Go 侧二进制替换与重启；
 * 托盘手动「检查更新」的结果（app:update-result）以消息提示。
 * 事件协议与 Go 侧 main.go（initUpdater）及 tray.go 对应。
 */
import { Events } from '@wailsio/runtime'
import { useI18n } from '@/i18n'
import MessageBoxUtil from '@/utils/modal/MessageBoxUtil'
import MessageUtil from '@/utils/modal/MessageUtil'

/** app:update-result 事件负载（对应托盘「检查更新」结果） */
interface UpdateResultPayload {
  status: 'up-to-date' | 'error'
  message?: string
}

/** 更新桥接只挂载一次（避免 dev 热更新重复绑定） */
let updaterBridgeAttached = false

export function useUpdater() {
  if (updaterBridgeAttached) return
  updaterBridgeAttached = true

  const { t } = useI18n()

  // 更新已下载并暂存 → 询问是否立即重启生效；取消（稍后）则忽略，下次检查会再次提醒
  Events.On('app:update-ready', () => {
    void MessageBoxUtil.confirm(t('updater.readyDesc'), t('updater.readyTitle'), {
      confirmButtonText: t('updater.restart'),
      cancelButtonText: t('updater.later')
    })
      .then(() => Events.Emit('app:update-restart'))
      .catch(() => undefined)
  })

  // 托盘「检查更新」结果反馈（有更新时走 app:update-ready 弹窗，这里只提示最新/失败）
  Events.On('app:update-result', (ev: { data: UpdateResultPayload }) => {
    if (ev.data.status === 'error') {
      MessageUtil.error(t('updater.checkFailed'), ev.data.message)
    } else {
      MessageUtil.success(t('updater.upToDate'))
    }
  })
}

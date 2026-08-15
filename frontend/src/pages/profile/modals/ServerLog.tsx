import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import ServerLogContent from './ServerLogContent.vue'
import { useI18n } from '@/i18n'

/**
 * 运行日志弹窗：展示 web 服务的实时运行日志（store.server.logTail）。
 */
export function openServerLog() {
  const { t } = useI18n()
  const dialog = DialogPlugin({
    header: t('server.log'),
    placement: 'center',
    width: '70vw',
    body: () =>
      h(ServerLogContent, {
        onClose: () => dialog.destroy()
      }),
    footer: false,
    destroyOnClose: true
  })
}

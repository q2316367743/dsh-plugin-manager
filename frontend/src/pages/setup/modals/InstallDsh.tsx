import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import InstallDshContent from './InstallDshContent.vue'
import { useI18n } from '@/i18n'

/**
 * 安装 dsh 弹窗：执行全局安装命令（bun/npm）并流式展示控制台输出。
 * 弹窗只能通过内容组件的「取消 / 关闭」按钮关闭，禁用 esc / 遮罩 / close 按钮。
 */
export function openInstallDsh(options: { command: string; args: string[]; onSuccess?: () => void }) {
  const { t } = useI18n()
  const dialog = DialogPlugin({
    header: t('installDsh.title'),
    placement: 'center',
    width: '560px',
    closeBtn: false,
    closeOnEscKeydown: false,
    closeOnOverlayClick: false,
    body: () =>
      h(InstallDshContent, {
        command: options.command,
        args: options.args,
        onSuccess: () => {
          dialog?.destroy?.()
          options.onSuccess?.()
        },
        onClose: () => dialog?.destroy?.()
      }),
    footer: false,
    destroyOnClose: true
  })
}

import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import InstallPluginContent from './InstallPluginContent.vue'
import { useI18n } from '@/i18n'
import type { BundleItem } from '@/types/dsh'

/**
 * 更新插件抽屉：对目标插件执行 dsh plugin --profile <p> update <name>，
 * 复用 InstallPluginContent 的可中断 CLI + ANSI 控制台交互。
 * 抽屉只能通过内容组件的「取消」按钮关闭，禁用 esc / 遮罩 / close 按钮。
 */
export function openUpdatePlugin(options: { profile: string; item: BundleItem }) {
  const { t } = useI18n()
  const drawer = DrawerPlugin({
    header: t('update.title'),
    placement: 'right',
    size: '560px',
    closeBtn: false,
    closeOnEscKeydown: false,
    closeOnOverlayClick: false,
    body: () =>
      h(InstallPluginContent, {
        profile: options.profile,
        mode: 'update',
        item: options.item,
        onClose: () => drawer?.destroy?.()
      }),
    footer: false,
    destroyOnClose: true
  })
}

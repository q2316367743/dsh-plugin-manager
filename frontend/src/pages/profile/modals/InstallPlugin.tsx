import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import InstallPluginContent from './InstallPluginContent.vue'
import { useI18n } from '@/i18n'

/**
 * 安装插件抽屉：直装 spec（npm 包 / github:user/repo#branch）+ 可中断流式日志。
 * 抽屉只能通过内容组件的「取消」按钮关闭，禁用 esc / 遮罩 / close 按钮。
 */
export function openInstallPlugin(options: { profile: string }) {
  const { t } = useI18n()
  const drawer = DrawerPlugin({
    header: t('install.title'),
    placement: 'right',
    size: '560px',
    closeBtn: false,
    closeOnEscKeydown: false,
    closeOnOverlayClick: false,
    body: () =>
      h(InstallPluginContent, {
        profile: options.profile,
        onClose: () => drawer?.destroy?.()
      }),
    footer: false,
    destroyOnClose: true
  })
}

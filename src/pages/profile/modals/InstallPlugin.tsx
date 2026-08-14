import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import InstallPluginContent from './InstallPluginContent.vue'
import { useI18n } from '@/i18n'

/**
 * 安装插件抽屉：npm / GitHub 搜索 + 直接安装 + 流式日志
 */
export function openInstallPlugin(options: { profile: string }) {
  const { t } = useI18n()
  const drawer = DrawerPlugin({
    header: t('install.title'),
    placement: 'right',
    size: '560px',
      body: () =>
        h(InstallPluginContent, {
          profile: options.profile,
          onClose: () => drawer?.destroy?.()
        }),
    footer: false,
    destroyOnClose: true
  })
}

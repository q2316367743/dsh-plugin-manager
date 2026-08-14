import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import PluginConfigContent from './PluginConfigContent.vue'
import { useI18n } from '@/i18n'
import type { BundleItem } from '@/types/dsh'

/**
 * 插件 config 编辑弹窗：编辑 profile patch 中目标行的 config 覆盖（JSON）
 */
export function openPluginConfig(options: { profile: string; bundle: BundleItem }) {
  const { t } = useI18n()
  const dialog = DialogPlugin({
    header: `${t('config.title')} · ${options.bundle.name}`,
    placement: 'center',
    width: '560px',
    body: () =>
      h(PluginConfigContent, {
        profile: options.profile,
        bundle: options.bundle,
        onClose: () => dialog.destroy(),
        onSuccess: () => dialog.destroy()
      }),
    footer: false,
    destroyOnClose: true
  })
}

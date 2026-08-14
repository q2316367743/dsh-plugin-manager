import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import ImportProfileContent from './ImportProfileContent.vue'
import { useI18n } from '@/i18n'

/**
 * 导入 profile 视图弹窗：选择 JSON 文件 → 预览 → 应用
 */
export function openImportProfile(options: { profile: string }) {
  const { t } = useI18n()
  const dialog = DialogPlugin({
    header: t('import.title'),
    placement: 'center',
    width: '560px',
    body: () =>
      h(ImportProfileContent, {
        profile: options.profile,
        onClose: () => dialog.destroy(),
        onSuccess: () => dialog.destroy()
      }),
    footer: false,
    destroyOnClose: true
  })
}

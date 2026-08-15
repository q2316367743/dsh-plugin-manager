import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import SettingsYamlContent from './SettingsYamlContent.vue'
import { useI18n } from '@/i18n'

/**
 * 全局设置编辑弹窗：编辑 ~/.dsh/settings.yaml（YAML 语言编辑器）
 */
export function openSettingsYaml() {
  const { t } = useI18n()
  const dialog = DialogPlugin({
    header: t('settings.yaml.title'),
    placement: 'center',
    width: '80vw',
    body: () =>
      h(SettingsYamlContent, {
        onClose: () => dialog.destroy(),
        onSaved: () => dialog.destroy()
      }),
    footer: false,
    destroyOnClose: true
  })
}

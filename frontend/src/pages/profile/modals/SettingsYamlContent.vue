<template>
  <div class="settings-yaml">
    <t-form>
      <t-form-item :label="t('settings.yaml.pathLabel')" label-align="top">
        <span class="path">{{ settingsPath }}</span>
      </t-form-item>
      <CodeEditor v-model="yamlText" language="yaml" height="420px" />
    </t-form>
    <div class="footer">
      <t-button variant="outline" :disabled="saving" @click="emit('close')">
        {{ t('common.cancel') }}
      </t-button>
      <t-button theme="primary" :loading="saving" @click="save">
        {{ t('common.save') }}
      </t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { parse } from 'yaml'
import { dshApi } from '@/api/dsh'
import { useI18n } from '@/i18n'
import MessageUtil from '@/utils/modal/MessageUtil'
import CodeEditor from '@/components/CodeEditor.vue'

const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const { t } = useI18n()

const yamlText = ref('')
const saving = ref(false)
const settingsPath = ref('')

onMounted(async () => {
  settingsPath.value = `${await dshApi.getDshHome()}/settings.yaml`
  yamlText.value = await dshApi.readDshSettings()
})

async function save() {
  try {
    parse(yamlText.value)
  } catch (error) {
    MessageUtil.error(
      t('settings.yaml.invalidYaml', {
        error: error instanceof Error ? error.message : String(error)
      })
    )
    return
  }
  saving.value = true
  try {
    await dshApi.writeDshSettings(yamlText.value)
    MessageUtil.success(t('settings.yaml.saved'))
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>
<style scoped lang="less">
.settings-yaml {
  margin-bottom: -16px;
  width: calc(100% - 2px);

  .path {
    color: var(--td-text-color-secondary);
    font-size: 12px;
    word-break: break-all;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 12px;
  }
}
</style>

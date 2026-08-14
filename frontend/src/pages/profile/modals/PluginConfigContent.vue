<template>
  <div class="config">
    <t-form layout="vertical">
      <t-form-item :label="t('config.row')">
        <t-select v-model="rowId" :options="rowOptions" />
      </t-form-item>
      <t-form-item :label="t('config.jsonLabel')">
        <t-textarea
          v-model="jsonText"
          :autosize="{ minRows: 10, maxRows: 24 }"
          class="json-editor"
        />
      </t-form-item>
    </t-form>
    <div class="footer">
      <t-button variant="outline" @click="emit('close')">{{ t('common.cancel') }}</t-button>
      <t-button theme="primary" :loading="saving" @click="save">{{ t('common.save') }}</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useDshStore } from '@/store/dsh'
import { useI18n } from '@/i18n'
import MessageUtil from '@/utils/modal/MessageUtil'
import type { BundleItem } from '@/types/dsh'

const props = defineProps<{ profile: string; bundle: BundleItem }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'success'): void }>()

const store = useDshStore()
const { t } = useI18n()

const rowId = ref(props.bundle.rows[0]?.id ?? props.bundle.name)
const jsonText = ref('{}')
const saving = ref(false)

const rowOptions = computed(() =>
  props.bundle.rows.map((row) => ({ label: row.id, value: row.id }))
)

async function loadConfig() {
  const config = await store.readPluginConfig(rowId.value)
  jsonText.value = JSON.stringify(config ?? {}, null, 2)
}

watch(rowId, () => void loadConfig())

onMounted(() => void loadConfig())

async function save() {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonText.value) as Record<string, unknown>
  } catch (error) {
    MessageUtil.error(
      t('config.invalidJson', { error: error instanceof Error ? error.message : String(error) })
    )
    return
  }
  saving.value = true
  try {
    await store.savePluginConfig(rowId.value, parsed)
    MessageUtil.success(t('config.saved'))
    emit('success')
  } finally {
    saving.value = false
  }
}
</script>
<style scoped lang="less">
.config {
  .json-editor {
    font-family: monospace;
    font-size: 12px;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>

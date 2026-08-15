<template>
  <div class="config">
    <t-form>
      <t-form-item :label="t('config.row')" label-align="top">
        <t-select v-model="rowId" :options="rowOptions"/>
      </t-form-item>
      <t-form-item :label="t('config.jsonLabel')" label-align="top">
        <CodeEditor v-model="jsonText" language="json" height="360px" />
      </t-form-item>
    </t-form>
    <div class="footer">
      <t-button variant="outline" @click="emit('close')">{{ t('common.cancel') }}</t-button>
      <t-button theme="primary" :loading="saving" @click="save">{{ t('common.save') }}</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import {useDshStore} from '@/store/dsh'
import {useI18n} from '@/i18n'
import MessageUtil from '@/utils/modal/MessageUtil'
import CodeEditor from '@/components/CodeEditor.vue'
import type {BundleItem} from '@/types/dsh'

const props = defineProps<{ profile: string; bundle: BundleItem }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'success'): void }>()

const store = useDshStore()
const {t} = useI18n()

const rowId = ref(props.bundle.rows[0]?.id ?? props.bundle.name)
const jsonText = ref('{}')
const saving = ref(false)

const rowOptions = computed(() =>
  props.bundle.rows.map((row) => ({label: row.id, value: row.id}))
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
      t('config.invalidJson', {error: error instanceof Error ? error.message : String(error)})
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
  margin-bottom: -16px;

  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 12px;
  }
}
</style>

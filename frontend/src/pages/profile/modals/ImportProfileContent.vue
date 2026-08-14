<template>
  <div class="import">
    <div class="pick-row">
      <t-input :value="fileName" readonly :placeholder="t('import.chooseFile')" class="flex-1" />
      <t-button variant="outline" @click="pickFile">
        <template #icon><folder-icon /></template>
        {{ t('import.chooseFile') }}
      </t-button>
    </div>

    <template v-if="preview">
      <t-divider />
      <div class="preview">
        <div class="preview-label">{{ t('import.bundles', { count: preview.bundles.length }) }}</div>
        <div class="preview-tags">
          <t-tag v-for="name in preview.bundles" :key="name" size="small" class="preview-tag">
            {{ name }}
          </t-tag>
        </div>
        <div class="preview-label mt-8px">
          {{ t('import.patches', { count: preview.patches.length }) }}
        </div>
        <t-alert v-if="preview.missing.length" theme="warning" class="mt-8px">
          {{ t('import.missing', { names: preview.missing.join(', ') }) }}
        </t-alert>
      </div>
      <div class="footer">
        <t-button variant="outline" @click="emit('close')">{{ t('common.cancel') }}</t-button>
        <t-button theme="primary" :loading="applying" @click="apply">
          {{ t('import.apply') }}
        </t-button>
      </div>
    </template>
  </div>
</template>
<script lang="ts" setup>
import { FolderIcon } from 'tdesign-icons-vue-next'
import { dshApi } from '@/api/dsh'
import { nativeApi } from '@/api/native'
import { useDshStore } from '@/store/dsh'
import { useI18n } from '@/i18n'
import MessageUtil from '@/utils/modal/MessageUtil'
import type { PatchEntry, ProfileExport } from '@/types/dsh'

const props = defineProps<{ profile: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'success'): void }>()

const store = useDshStore()
const { t } = useI18n()

const fileName = ref('')
const filePath = ref('')
const applying = ref(false)
const preview = ref<{ bundles: string[]; patches: PatchEntry[]; missing: string[] } | null>(null)

async function pickFile() {
  const files = await nativeApi.dialog.open({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (!files || files.length === 0) return
  filePath.value = files[0]
  fileName.value = files[0].split('/').pop() ?? files[0]
  await parsePreview()
}

async function parsePreview() {
  preview.value = null
  try {
    const raw = await dshApi.readTextFile(filePath.value)
    const data = JSON.parse(raw) as ProfileExport
    if (!Array.isArray(data.bundles) || !Array.isArray(data.patches)) {
      throw new Error('missing "bundles" or "patches" array')
    }
    const manifest = await dshApi.readProfileManifest(props.profile)
    const installed = Object.keys(manifest?.dependencies ?? {})
    const missing = data.bundles.filter((name) => !installed.includes(name))
    preview.value = { bundles: data.bundles, patches: data.patches, missing }
  } catch (error) {
    MessageUtil.error(
      t('import.invalidFile', { error: error instanceof Error ? error.message : String(error) })
    )
  }
}

async function apply() {
  if (!filePath.value) return
  applying.value = true
  try {
    const { missing } = await store.importProfileFromFile(filePath.value)
    MessageUtil.success(t('import.applied'))
    emit('success')
  } catch (error) {
    MessageUtil.error(
      t('import.invalidFile', { error: error instanceof Error ? error.message : String(error) })
    )
  } finally {
    applying.value = false
  }
}
</script>
<style scoped lang="less">
.import {
  .pick-row {
    display: flex;
    gap: 8px;
  }

  .preview {
    .preview-label {
      font-size: 13px;
      color: var(--td-text-color-primary);
      font-weight: 600;
    }

    .preview-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 8px;

      .preview-tag {
        max-width: 200px;
      }
    }
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
}
</style>

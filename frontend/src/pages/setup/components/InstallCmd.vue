<template>
  <div class="install-cmd">
    <t-tag theme="primary" variant="light">{{ t(labelKey) }}</t-tag>
    <code class="cmd">{{ cmd }}</code>
    <t-button v-if="binPath" size="small" variant="outline" theme="primary" @click="emit('install', binPath)">
      {{ t('banner.install') }}
    </t-button>
    <t-button size="small" variant="text" shape="square" @click="emit('copy', cmd)">
      <copy-icon/>
    </t-button>
  </div>
</template>
<script lang="ts" setup>
import {CopyIcon} from 'tdesign-icons-vue-next'
import {useI18n} from '@/i18n'
import type {I18nKey} from '@/i18n'

defineProps<{
  labelKey: I18nKey
  cmd: string
  binPath: string
}>()
const emit = defineEmits<{ (e: 'copy', cmd: string): void; (e: 'install', binPath: string): void }>()

const {t} = useI18n()
</script>
<style scoped lang="less">
.install-cmd {
  display: flex;
  align-items: center;
  gap: 8px;

  .cmd {
    flex: 1;
    padding: 6px 10px;
    border-radius: var(--td-radius-default);
    background-color: var(--td-bg-color-component);
    border: 1px solid var(--td-border-level-1-color);
    font-size: 12px;
    font-family: monospace;
    color: var(--td-text-color-primary);
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>

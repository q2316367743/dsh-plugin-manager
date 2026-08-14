<template>
  <div class="plugin-card">
    <div class="plugin-info">
      <div class="plugin-title">
        <span class="plugin-name">{{ item.name }}</span>
        <t-tag size="small" :theme="item.official ? 'primary' : 'default'" variant="light">
          {{ item.official ? t('list.official') : t('list.thirdParty') }}
        </t-tag>
        <t-tag v-if="!item.official" size="small" variant="outline">{{ sourceLabel }}</t-tag>
        <span class="plugin-version">v{{ item.version }}</span>
      </div>
      <div class="plugin-desc">{{ item.description }}</div>
      <div class="plugin-rows">
        <t-tooltip v-if="item.official && rowsLabel" :content="rowsLabel" placement="top">
          <span class="plugin-rows--truncate">{{ rowsLabel }}</span>
        </t-tooltip>
        <template v-else>{{ rowsLabel }}</template>
      </div>
    </div>
    <div class="plugin-actions">
      <t-switch
        :value="item.enabled"
        :disabled="item.official"
        @change="onToggle"
      />
      <t-dropdown :options="menuOptions" trigger="click" @click="onMenu">
        <t-button variant="text" shape="square">
          <more-icon />
        </t-button>
      </t-dropdown>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { DropdownOption } from 'tdesign-vue-next'
import { MoreIcon } from 'tdesign-icons-vue-next'
import type { BundleItem } from '@/types/dsh'
import { useI18n } from '@/i18n'

const props = defineProps<{ item: BundleItem }>()
const emit = defineEmits<{
  (e: 'toggle', enabled: boolean): void
  (e: 'action', value: string): void
}>()

const { t } = useI18n()

const sourceLabel = computed(() => {
  switch (props.item.source) {
    case 'npm':
      return t('plugin.source.npm')
    case 'github':
      return t('plugin.source.github')
    case 'local':
      return t('plugin.source.local')
    default:
      return t('plugin.source.unknown')
  }
})

const rowsLabel = computed(() => props.item.rows.map((row) => row.id).join(' · '))

const menuOptions = computed(() => {
  const options: Array<{ content: string; value: string }> = [
    { content: t('plugin.config'), value: 'config' },
    { content: t('plugin.update'), value: 'update' }
  ]
  const url = props.item.homepage || props.item.repository
  if (url) options.push({ content: t('plugin.openHomepage'), value: 'homepage' })
  if (!props.item.official) options.push({ content: t('plugin.remove'), value: 'remove' })
  return options
})

function onToggle(enabled: boolean | string | number) {
  emit('toggle', !!enabled)
}

function onMenu(data: DropdownOption) {
  emit('action', String(data.value))
}
</script>
<style scoped lang="less">
.plugin-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;

  .plugin-info {
    flex: 1;
    min-width: 0;

    .plugin-title {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;

      .plugin-name {
        font-weight: 600;
        color: var(--td-text-color-primary);
      }

      .plugin-version {
        font-size: 12px;
        color: var(--td-text-color-placeholder);
      }
    }

    .plugin-desc {
      margin-top: 4px;
      font-size: 12px;
      color: var(--td-text-color-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .plugin-rows {
      margin-top: 2px;
      font-size: 11px;
      color: var(--td-text-color-placeholder);

      .plugin-rows--truncate {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }

  .plugin-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
}
</style>

<template>
  <t-card :title="title" class="group-card">
    <div class="group-list">
      <div v-for="item in items" :key="item.name" class="group-row">
        <PluginCard
          :item="item"
          @toggle="(enabled: boolean) => emit('toggle', item, enabled)"
          @action="(value: string) => emit('action', item, value)"
        />
      </div>
    </div>
  </t-card>
</template>
<script lang="ts" setup>
import PluginCard from './PluginCard.vue'
import type { BundleItem } from '@/types/dsh'

defineProps<{
  title: string
  items: BundleItem[]
}>()

const emit = defineEmits<{
  (e: 'toggle', item: BundleItem, enabled: boolean): void
  (e: 'action', item: BundleItem, value: string): void
}>()
</script>
<style scoped lang="less">
.group-card {
  .group-list {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .group-row {
      border-radius: var(--td-radius-default);
      transition: background-color 0.2s, box-shadow 0.2s;

      &:hover {
        background-color: var(--td-bg-color-secondarycontainer);
      }
    }
  }
}
</style>

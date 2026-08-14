<template>
  <t-card :title="title" class="group-card">
    <div class="group-list">
      <div
        v-for="(item, index) in items"
        :key="item.name"
        class="group-row"
        :class="{ dragging: dragIndex === index }"
        draggable="true"
        @dragstart="onDragStart($event, index)"
        @dragover.prevent
        @drop.prevent="onDrop(index)"
        @dragend="dragIndex = -1"
      >
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
  (e: 'move', range: { from: number; to: number }): void
}>()

const dragIndex = ref(-1)

function onDragStart(event: DragEvent, index: number) {
  dragIndex.value = index
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDrop(index: number) {
  if (dragIndex.value >= 0 && dragIndex.value !== index) {
    emit('move', { from: dragIndex.value, to: index })
  }
  dragIndex.value = -1
}
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

      &.dragging {
        opacity: 0.5;
        box-shadow: var(--td-shadow-1);
      }
    }
  }
}
</style>

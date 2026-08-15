<template>
  <div class="server-log">
    <pre v-if="logTail" ref="logRef" class="log-area">{{ logTail }}</pre>
    <span v-else class="log-empty">{{ t('server.logEmpty') }}</span>
    <div class="footer">
      <t-button variant="outline" @click="emit('close')">
        {{ t('common.cancel') }}
      </t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { nextTick, onMounted, watch } from 'vue'
import { useDshStore } from '@/store/dsh'
import { useI18n } from '@/i18n'

const emit = defineEmits<{ (e: 'close'): void }>()

const store = useDshStore()
const { t } = useI18n()

const logRef = ref<HTMLElement>()
const logTail = computed(() => store.server.logTail)

function scrollToBottom() {
  nextTick(() => {
    if (logRef.value) {
      logRef.value.scrollTop = logRef.value.scrollHeight
    }
  })
}

watch(logTail, scrollToBottom)
onMounted(scrollToBottom)
</script>
<style scoped lang="less">
.server-log {
  width: calc(100% - 2px);

  .log-area {
    margin: 0;
    padding: 8px 12px;
    height: 55vh;
    overflow: auto;
    border-radius: var(--td-radius-default);
    background-color: var(--td-bg-color-component);
    font-size: 12px;
    font-family: monospace;
    line-height: 1.6;
    color: var(--td-text-color-primary);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .log-empty {
    display: block;
    padding: 48px 0;
    text-align: center;
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 12px;
  }
}
</style>

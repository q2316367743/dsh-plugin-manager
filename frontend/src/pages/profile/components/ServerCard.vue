<template>
  <t-card class="server-card">
    <div class="server-row">
      <div class="server-title">
        <span class="status-dot" :class="store.server.status" />
        <span class="server-name">{{ t('server.title') }}</span>
        <t-tag size="small" :theme="statusTagTheme" variant="light">{{ statusText }}</t-tag>
      </div>
      <span class="server-port">{{ t('server.port') }}: {{ store.settings.port }}</span>
      <div class="flex-1" />
      <t-button
        v-if="store.server.status === 'stopped' || store.server.status === 'unknown'"
        theme="primary"
        :loading="store.server.busy"
        :disabled="!store.dshOk || store.server.busy"
        @click="store.serverStart()"
      >
        <template #icon><play-icon /></template>
        {{ t('server.start') }}
      </t-button>
      <t-button
        v-else
        theme="danger"
        variant="outline"
        :loading="store.server.busy"
        :disabled="store.server.busy"
        @click="store.serverStop()"
      >
        <template #icon><poweroff-icon /></template>
        {{ t('server.stop') }}
      </t-button>
      <t-button
        variant="outline"
        :disabled="store.server.status === 'stopped' || store.server.status === 'unknown'"
        @click="store.serverOpen()"
      >
        <template #icon><server-icon /></template>
        {{ t('server.open') }}
      </t-button>
    </div>
    <t-collapse v-if="store.server.logTail" class="server-log">
      <t-collapse-panel :header="t('server.log')">
        <pre class="log-area">{{ store.server.logTail }}</pre>
      </t-collapse-panel>
    </t-collapse>
  </t-card>
</template>
<script lang="ts" setup>
import { PlayIcon, PoweroffIcon, ServerIcon } from 'tdesign-icons-vue-next'
import { useDshStore } from '@/store/dsh'
import { useI18n } from '@/i18n'

const store = useDshStore()
const { t } = useI18n()

const statusText = computed(() => {
  switch (store.server.status) {
    case 'running-own':
      return t('server.runningOwn')
    case 'running-foreign':
      return t('server.runningForeign')
    case 'stopped':
      return t('server.stopped')
    default:
      return t('server.unknown')
  }
})

const statusTagTheme = computed(() => {
  switch (store.server.status) {
    case 'running-own':
    case 'running-foreign':
      return 'success'
    case 'stopped':
      return 'default'
    default:
      return 'warning'
  }
})
</script>
<style scoped lang="less">
.server-card {
  .server-row {
    display: flex;
    align-items: center;
    gap: 12px;

    .server-title {
      display: flex;
      align-items: center;
      gap: 8px;

      .server-name {
        font-weight: 600;
        color: var(--td-text-color-primary);
      }
    }

    .server-port {
      font-size: 13px;
      color: var(--td-text-color-secondary);
    }
  }

  .server-log {
    margin-top: 12px;

    .log-area {
      margin: 0;
      padding: 8px 12px;
      max-height: 240px;
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
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;

  &.running-own,
  &.running-foreign {
    background-color: var(--td-success-color);
  }

  &.stopped {
    background-color: var(--td-text-color-placeholder);
  }

  &.unknown {
    background-color: var(--td-warning-color);
  }
}
</style>

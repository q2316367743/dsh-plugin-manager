<template>
  <t-card class="server-card">
    <div class="server-row">
      <div class="server-title">
        <span class="status-dot" :class="store.server.status" />
        <span class="server-name">{{ t('server.title') }}</span>
        <t-tag size="small" :theme="statusTagTheme" variant="light">{{ statusText }}</t-tag>
      </div>
      <span class="server-port">{{ t('server.port') }}: {{ store.settings.port }}</span>
      <t-link
        class="log-link"
        theme="primary"
        :disabled="!store.server.logTail"
        @click="openServerLog"
      >
        <template #prefixIcon><system-log-icon /></template>
        {{ t('server.log') }}
      </t-link>
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
      <t-button variant="outline" shape="square" @click="router.push('/settings')">
        <template #icon><setting1-icon /></template>
      </t-button>
    </div>
  </t-card>
</template>
<script lang="ts" setup>
import { PlayIcon, PoweroffIcon, ServerIcon, Setting1Icon, SystemLogIcon } from 'tdesign-icons-vue-next'
import { useRouter } from 'vue-router'
import { useDshStore } from '@/store/dsh'
import { useI18n } from '@/i18n'
import { openServerLog } from '../modals/ServerLog'

const store = useDshStore()
const { t } = useI18n()
const router = useRouter()

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

    .log-link {
      font-size: 13px;
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

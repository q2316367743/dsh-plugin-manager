<template>
  <div class="install">
    <!-- 输入（安装）或 目标插件（更新）+ 主按钮 -->
    <div class="input-row">
      <t-input
        v-if="mode === 'install'"
        v-model="spec"
        :placeholder="t('install.placeholder')"
        :disabled="running"
        clearable
        @enter="onRun"
      >
        <template #prefix-icon><install-icon /></template>
      </t-input>
      <div v-else class="update-target">
        <install-icon />
        <span class="update-name">{{ item?.name }}</span>
        <t-tag v-if="item?.version" size="small" variant="outline">v{{ item.version }}</t-tag>
      </div>
      <t-button
        :theme="running ? 'danger' : 'primary'"
        :disabled="!running && !canRun"
        @click="onRun"
      >
        {{ running ? t(task.cancelKey) : t(task.nameKey) }}
      </t-button>
    </div>

    <!-- 控制台输出 -->
    <div class="console">
      <pre v-if="logs" class="log-area"><span v-html="consoleHtml" /></pre>
      <span v-else class="console-hint">{{ t(task.consoleHintKey) }}</span>
    </div>

    <!-- 底部：取消 -->
    <div class="drawer-footer">
      <t-button variant="outline" :disabled="running" @click="emit('close')">
        {{ t('install.cancel') }}
      </t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { InstallIcon } from 'tdesign-icons-vue-next'
import { dshApi } from '@/api/dsh'
import { useDshStore } from '@/store/dsh'
import { useI18n } from '@/i18n'
import type { I18nKey } from '@/i18n'
import { ansiToHtml } from '@/utils/ansi'
import MessageUtil from '@/utils/modal/MessageUtil'
import MessageBoxUtil from '@/utils/modal/MessageBoxUtil'
import type { BundleItem } from '@/types/dsh'

const props = defineProps<{
  profile: string
  mode?: 'install' | 'update'
  item?: BundleItem
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useDshStore()
const { t } = useI18n()

const mode = computed(() => props.mode ?? 'install')
const spec = ref('')
const running = ref(false)
const logs = ref('')
const currentPid = ref(0)
/** 用户主动取消（区别于进程自然失败退出） */
const cancelled = ref(false)

/** 按模式聚合任务文案 key */
const task = computed(() =>
  mode.value === 'install'
    ? {
        nameKey: 'install.install' as I18nKey,
        cancelKey: 'install.cancelInstall' as I18nKey,
        consoleHintKey: 'install.consolePlaceholder' as I18nKey,
        spawnFailedKey: 'install.spawnFailed' as I18nKey,
        killedKey: 'install.killed' as I18nKey,
        failedKey: 'install.failed' as I18nKey,
        restartAskKey: 'install.restartAsk' as I18nKey
      }
    : {
        nameKey: 'update.update' as I18nKey,
        cancelKey: 'update.cancelUpdate' as I18nKey,
        consoleHintKey: 'update.consolePlaceholder' as I18nKey,
        spawnFailedKey: 'update.spawnFailed' as I18nKey,
        killedKey: 'update.killed' as I18nKey,
        failedKey: 'update.failed' as I18nKey,
        restartAskKey: 'update.restartAsk' as I18nKey
      }
)

const consoleHtml = computed(() => ansiToHtml(logs.value))

const canRun = computed(() => (mode.value === 'install' ? !!spec.value.trim() : true))

async function onRun() {
  if (running.value) {
    await cancelRun()
    return
  }
  const target = mode.value === 'install' ? spec.value.trim() : props.item?.name ?? ''
  if (!target) return
  const runner = store.dshCommand()
  if (!runner) {
    logs.value = t(task.value.spawnFailedKey) + '\n'
    return
  }
  running.value = true
  cancelled.value = false
  logs.value = ''
  const jobId = `install-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const args =
    mode.value === 'install'
      ? ['plugin', '--profile', props.profile, 'add', target]
      : ['plugin', '--profile', props.profile, 'update', target]
  const { pid, exit } = await dshApi.runCliInterruptible(
    jobId,
    runner.command,
    [...runner.prefix, ...args],
    (_stream, text) => (logs.value += text)
  )
  if (pid <= 0) {
    running.value = false
    logs.value += t(task.value.spawnFailedKey) + '\n'
    return
  }
  currentPid.value = pid
  // 覆盖「启动窗口期内已点取消」的情况
  if (cancelled.value) {
    await dshApi.kill(pid)
  }
  const code = await exit
  currentPid.value = 0
  running.value = false
  if (cancelled.value) {
    logs.value += t(task.value.killedKey) + '\n'
    return
  }
  if (code === 0) {
    await store.loadProfile(props.profile)
    await maybeRestartWeb()
    emit('close')
  } else {
    logs.value += t(task.value.failedKey, { code }) + '\n'
  }
}

async function cancelRun() {
  cancelled.value = true
  if (currentPid.value > 0) {
    await dshApi.kill(currentPid.value)
  }
}

/** web profile 安装 / 更新成功后，若 web 服务在运行则询问是否重启 */
async function maybeRestartWeb() {
  if (props.profile !== 'web') return
  const status = store.server.status
  if (status === 'stopped' || status === 'unknown') return
  if (status === 'running-foreign') {
    MessageUtil.info(t('restart.foreign'))
    return
  }
  try {
    await MessageBoxUtil.confirm(t(task.value.restartAskKey), t('restart.title'), {
      confirmButtonText: t('restart.now'),
      cancelButtonText: t('restart.later')
    })
  } catch {
    return // 点「稍后」或关闭 dialog → 不重启
  }
  MessageUtil.info(t('restart.restarting'))
  await store.restartServer()
  MessageUtil.success(t('restart.done'))
}

// drawer destroyOnClose 销毁组件时兜底杀掉未结束的进程
onBeforeUnmount(() => {
  if (currentPid.value > 0) {
    void dshApi.kill(currentPid.value)
  }
})
</script>
<style scoped lang="less">
.install {
  display: flex;
  flex-direction: column;
  height: 100%;

  .input-row {
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.t-input) {
      flex: 1;
      min-width: 0;
    }

    .update-target {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      height: 40px;
      border-radius: var(--td-radius-default);
      background-color: var(--td-bg-color-component);

      .update-name {
        flex: 1;
        min-width: 0;
        font-weight: 600;
        color: var(--td-text-color-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }

  .console {
    flex: 1;
    min-height: 0;
    margin-top: 12px;
    padding: 8px 12px;
    overflow: auto;
    border-radius: var(--td-radius-default);
    background-color: var(--td-bg-color-component);

    .log-area {
      margin: 0;
      font-size: 12px;
      font-family: monospace;
      line-height: 1.6;
      color: var(--td-text-color-primary);
      white-space: pre-wrap;
      word-break: break-all;
    }

    .console-hint {
      font-size: 12px;
      color: var(--td-text-color-placeholder);
    }
  }

  .drawer-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 12px;
  }
}
</style>

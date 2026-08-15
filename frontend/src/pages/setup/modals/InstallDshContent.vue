<template>
  <div class="install-dsh">
    <!-- 控制台输出 -->
    <div class="console">
      <pre v-if="logs" class="log-area"><span v-html="consoleHtml" /></pre>
      <span v-else class="console-hint">{{ t('installDsh.consolePlaceholder') }}</span>
    </div>

    <!-- 底部：运行中可取消，结束后关闭 -->
    <div class="footer">
      <t-button v-if="running" theme="danger" variant="outline" @click="cancelRun">
        {{ t('installDsh.cancel') }}
      </t-button>
      <t-button v-else variant="outline" @click="emit('close')">
        {{ t('installDsh.close') }}
      </t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { dshApi } from '@/api/dsh'
import { useDshStore } from '@/store/dsh'
import { useI18n } from '@/i18n'
import { ansiToHtml } from '@/utils/ansi'
import MessageUtil from '@/utils/modal/MessageUtil'

const props = defineProps<{
  command: string
  args: string[]
}>()
const emit = defineEmits<{ (e: 'success'): void; (e: 'close'): void }>()

const store = useDshStore()
const { t } = useI18n()

const running = ref(true)
const logs = ref('')
const currentPid = ref(0)
/** 用户主动取消（区别于进程自然失败退出） */
const cancelled = ref(false)

const consoleHtml = computed(() => ansiToHtml(logs.value))

async function start() {
  const jobId = `install-dsh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const { pid, exit } = await dshApi.runCliInterruptible(
    jobId,
    props.command,
    props.args,
    (_stream, text) => (logs.value += text)
  )
  if (pid <= 0) {
    running.value = false
    logs.value += t('installDsh.spawnFailed') + '\n'
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
    logs.value += t('installDsh.killed') + '\n'
    return
  }
  if (code === 0) {
    logs.value += t('installDsh.done') + '\n'
    // 安装结束后自动重新检测 dsh
    await store.resolveDsh()
    if (store.dsh.state === 'ok') {
      MessageUtil.success(t('banner.verified', { version: store.dsh.version ?? '' }))
      emit('success')
    } else {
      MessageUtil.error(t('banner.invalid', { error: store.dsh.error ?? '' }))
    }
  } else {
    logs.value += t('installDsh.failed', { code }) + '\n'
  }
}

async function cancelRun() {
  cancelled.value = true
  if (currentPid.value > 0) {
    await dshApi.kill(currentPid.value)
  }
}

// dialog destroyOnClose 销毁组件时兜底杀掉未结束的进程
onBeforeUnmount(() => {
  if (currentPid.value > 0) {
    void dshApi.kill(currentPid.value)
  }
})

void start()
</script>
<style scoped lang="less">
.install-dsh {
  display: flex;
  flex-direction: column;
  min-height: 280px;
  margin-bottom: -16px;

  .console {
    flex: 1;
    min-height: 220px;
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

  .footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 12px;

  }
}
</style>

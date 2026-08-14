<template>
  <div class="install">
    <!-- 输入 + 安装按钮 -->
    <div class="input-row">
      <t-input
        v-model="spec"
        :placeholder="t('install.placeholder')"
        :disabled="installing"
        clearable
        @enter="onInstall"
      >
        <template #prefix-icon><install-icon /></template>
      </t-input>
      <t-button
        :theme="installing ? 'danger' : 'primary'"
        :disabled="!installing && !spec.trim()"
        @click="onInstall"
      >
        {{ installing ? t('install.cancelInstall') : t('install.install') }}
      </t-button>
    </div>

    <!-- 控制台输出 -->
    <div class="console">
      <pre v-if="logs" class="log-area"><span v-html="consoleHtml" /></pre>
      <span v-else class="console-hint">{{ t('install.consolePlaceholder') }}</span>
    </div>

    <!-- 底部：取消 -->
    <div class="drawer-footer">
      <t-button variant="outline" :disabled="installing" @click="emit('close')">
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
import { ansiToHtml } from '@/utils/ansi'
import MessageUtil from '@/utils/modal/MessageUtil'
import MessageBoxUtil from '@/utils/modal/MessageBoxUtil'

const props = defineProps<{ profile: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useDshStore()
const { t } = useI18n()

const spec = ref('')
const installing = ref(false)
const logs = ref('')
const currentPid = ref(0)
/** 用户主动取消（区别于进程自然失败退出） */
const cancelled = ref(false)

const consoleHtml = computed(() => ansiToHtml(logs.value))

async function onInstall() {
  if (installing.value) {
    await cancelInstall()
    return
  }
  const name = spec.value.trim()
  if (!name) return
  const runner = store.dshCommand()
  if (!runner) {
    logs.value = t('install.spawnFailed') + '\n'
    return
  }
  installing.value = true
  cancelled.value = false
  logs.value = ''
  const jobId = `install-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const { pid, exit } = await dshApi.runCliInterruptible(
    jobId,
    runner.command,
    [...runner.prefix, 'plugin', '--profile', props.profile, 'add', name],
    (_stream, text) => (logs.value += text)
  )
  if (pid <= 0) {
    installing.value = false
    logs.value += t('install.spawnFailed') + '\n'
    return
  }
  currentPid.value = pid
  // 覆盖「启动窗口期内已点取消」的情况
  if (cancelled.value) {
    await dshApi.kill(pid)
  }
  const code = await exit
  currentPid.value = 0
  installing.value = false
  if (cancelled.value) {
    logs.value += t('install.killed') + '\n'
    return
  }
  if (code === 0) {
    await store.loadProfile(props.profile)
    await maybeRestartWeb()
    emit('close')
  } else {
    logs.value += t('install.failed', { code }) + '\n'
  }
}

async function cancelInstall() {
  cancelled.value = true
  if (currentPid.value > 0) {
    await dshApi.kill(currentPid.value)
  }
}

/** web profile 安装成功后，若 web 服务在运行则询问是否重启 */
async function maybeRestartWeb() {
  if (props.profile !== 'web') return
  const status = store.server.status
  if (status === 'stopped' || status === 'unknown') return
  if (status === 'running-foreign') {
    MessageUtil.info(t('restart.foreign'))
    return
  }
  try {
    await MessageBoxUtil.confirm(t('install.restartAsk'), t('restart.title'), {
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

// drawer destroyOnClose 销毁组件时兜底杀掉未结束的安装进程
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
    gap: 8px;

    :deep(.t-input) {
      flex: 1;
      min-width: 0;
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

<template>
  <div class="setup-page">
    <div class="setup-card">
      <div class="setup-header">
        <div class="setup-logo">
          <command-icon />
        </div>
        <h1 class="setup-title">{{ t('banner.title') }}</h1>
        <p class="setup-desc">{{ t('banner.desc') }}</p>
      </div>

      <div class="setup-cmds">
        <div class="setup-cmd">
          <t-tag theme="primary" variant="light">{{ t('banner.installBun') }}</t-tag>
          <code class="cmd">bun install -g @deepseek-ai/dsh</code>
          <t-button size="small" variant="text" shape="square" @click="copyCmd('bun install -g @deepseek-ai/dsh')">
            <copy-icon />
          </t-button>
        </div>
        <div class="setup-cmd">
          <t-tag theme="primary" variant="light">{{ t('banner.installNpm') }}</t-tag>
          <code class="cmd">npm install -g @deepseek-ai/dsh</code>
          <t-button size="small" variant="text" shape="square" @click="copyCmd('npm install -g @deepseek-ai/dsh')">
            <copy-icon />
          </t-button>
        </div>
      </div>

      <t-divider />

      <div class="setup-manual">{{ t('banner.manual') }}</div>
      <div class="setup-form">
        <t-input v-model="pathInput" :placeholder="t('banner.placeholder')" clearable class="flex-1" />
        <t-button variant="outline" @click="chooseFile">
          <template #icon><folder-icon /></template>
          {{ t('banner.chooseFile') }}
        </t-button>
        <t-button theme="primary" :loading="verifying" @click="verify">
          {{ t('banner.verify') }}
        </t-button>
      </div>

      <div v-if="store.dsh.state === 'ok' && store.dsh.version" class="setup-ok">
        {{ t('banner.verified', { version: store.dsh.version }) }}
      </div>
      <div v-else-if="store.dsh.state === 'invalid'" class="setup-invalid">
        {{ t('banner.invalid', { error: store.dsh.error ?? '' }) }}
      </div>

      <div class="setup-footer">
        <t-button variant="text" @click="goSettings">{{ t('nav.settings') }}</t-button>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { CommandIcon, CopyIcon, FolderIcon } from 'tdesign-icons-vue-next'
import { useDshStore } from '@/store/dsh'
import { useI18n } from '@/i18n'
import MessageUtil from '@/utils/modal/MessageUtil'

const store = useDshStore()
const { t } = useI18n()
const router = useRouter()

const pathInput = ref(store.settings.dshPath || '')
const verifying = ref(false)

function copyCmd(cmd: string) {
  window.preload.inject.clipboard.copyText(cmd)
  MessageUtil.success(t('common.copied'))
}

/** 通过 utools 文件选择框选择 dsh 可执行文件 */
function chooseFile() {
  const files = window.preload.inject.dialog.open({ properties: ['openFile'] })
  if (files && files.length > 0) {
    pathInput.value = files[0]
  }
}

async function verify() {
  verifying.value = true
  try {
    await store.saveDshPath(pathInput.value.trim())
    if (store.dsh.state === 'ok') {
      MessageUtil.success(t('banner.verified', { version: store.dsh.version ?? '' }))
      // 校验通过，进入首页
      router.replace(store.currentProfile ? `/profile/${store.currentProfile}` : '/settings')
    } else {
      MessageUtil.error(t('banner.invalid', { error: store.dsh.error ?? '' }))
    }
  } finally {
    verifying.value = false
  }
}

function goSettings() {
  router.push('/settings')
}
</script>
<style scoped lang="less">
.setup-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: var(--td-bg-color-container);

  .setup-card {
    width: 100%;
    max-width: 620px;
    padding: 40px 48px;
    border-radius: var(--td-radius-large);
    background-color: var(--td-bg-color-container);
    border: 1px solid var(--td-border-level-1-color);
    box-shadow: var(--td-shadow-2);

    .setup-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;

      .setup-logo {
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 18px;
        color: #fff;
        background: linear-gradient(135deg, var(--td-brand-color), var(--td-brand-color-hover));
        box-shadow: var(--td-shadow-2);

        :deep(svg) {
          width: 28px;
          height: 28px;
        }
      }

      .setup-title {
        margin: 16px 0 8px;
        font-size: 22px;
        font-weight: 600;
        color: var(--td-text-color-primary);
      }

      .setup-desc {
        margin: 0;
        font-size: 13px;
        line-height: 1.7;
        color: var(--td-text-color-secondary);
      }
    }

    .setup-cmds {
      margin-top: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .setup-cmd {
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
    }

    .setup-manual {
      margin: 16px 0 8px;
      font-size: 13px;
      color: var(--td-text-color-secondary);
    }

    .setup-form {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .setup-ok {
      margin-top: 16px;
      font-size: 13px;
      color: var(--td-success-color);
    }

    .setup-invalid {
      margin-top: 16px;
      font-size: 13px;
      color: var(--td-error-color);
    }

    .setup-footer {
      margin-top: 16px;
      display: flex;
      justify-content: center;
    }
  }
}
</style>

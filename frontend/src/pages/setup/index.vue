<template>
  <div class="setup-page">
    <div class="setup-card">
      <div class="setup-header">
        <div class="setup-logo">
          <command-icon/>
        </div>
        <h1 class="setup-title">{{ t('banner.title') }}</h1>
        <p class="setup-desc">{{ t('banner.desc') }}</p>
      </div>

      <div class="setup-cmds">
        <InstallCmd
          label-key="banner.installBun"
          cmd="bun install -g @deepseek-ai/dsh"
          :bin-path="bunPath"
          @copy="copyCmd"
          @install="openInstall"
        />
        <InstallCmd
          label-key="banner.installNpm"
          cmd="npm install -g @deepseek-ai/dsh"
          :bin-path="npmPath"
          @copy="copyCmd"
          @install="openInstall"
        />
        <div v-if="!bunPath && !npmPath" class="tool-missing">{{ t('banner.toolMissing') }}</div>
        <div class="setup-links">
          <t-link theme="primary" hover="color" @click="openOfficialSite">
            <template #suffix>
              <link-icon/>
            </template>
            {{ t('banner.officialSite') }}
          </t-link>
        </div>
      </div>

      <div class="setup-refresh">
        <t-button variant="outline" theme="primary" :loading="refreshing" @click="refresh">
          <template #icon>
            <refresh-icon/>
          </template>
          {{ t('banner.refresh') }}
        </t-button>
      </div>

      <t-divider/>

      <div class="setup-manual">{{ t('banner.manual') }}</div>
      <div class="setup-form">
        <t-input v-model="pathInput" :placeholder="t('banner.placeholder')" clearable class="flex-1"/>
        <t-button variant="outline" @click="chooseFile">
          <template #icon>
            <folder-icon/>
          </template>
          {{ t('banner.chooseFile') }}
        </t-button>
        <t-button theme="primary" :loading="verifying" @click="verify">
          {{ t('banner.verify') }}
        </t-button>
      </div>

      <div v-if="store.dsh.state === 'ok' && store.dsh.version" class="setup-ok">
        {{ t('banner.verified', {version: store.dsh.version}) }}
      </div>
      <div v-else-if="store.dsh.state === 'invalid'" class="setup-invalid">
        {{ t('banner.invalid', {error: store.dsh.error ?? ''}) }}
      </div>

      <div class="setup-footer">
        <t-button variant="text" @click="goSettings">{{ t('nav.settings') }}</t-button>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import {onMounted} from 'vue'
import {useRouter} from 'vue-router'
import {CommandIcon, FolderIcon, LinkIcon, RefreshIcon} from 'tdesign-icons-vue-next'
import {useDshStore} from '@/store/dsh'
import {useI18n} from '@/i18n'
import MessageUtil from '@/utils/modal/MessageUtil'
import {nativeApi} from '@/api/native'
import {dshApi} from '@/api/dsh'
import InstallCmd from './components/InstallCmd.vue'
import {openInstallDsh} from './modals/InstallDsh'

const store = useDshStore()
const {t} = useI18n()
const router = useRouter()

const pathInput = ref(store.settings.dshPath || '')
const verifying = ref(false)
const refreshing = ref(false)
/** bun / npm 可执行文件路径，未检测到为空串 */
const bunPath = ref('')
const npmPath = ref('')

/** 探测 bun / npm 是否已安装（存在则记录可执行文件路径） */
async function detectTools() {
  const [bun, npm] = await Promise.all([dshApi.resolveToolBin('bun'), dshApi.resolveToolBin('npm')])
  bunPath.value = bun ?? ''
  npmPath.value = npm ?? ''
}

onMounted(() => {
  void detectTools()
})

async function copyCmd(cmd: string) {
  await nativeApi.clipboard.copyText(cmd)
  MessageUtil.success(t('common.copied'))
}

/** 使用默认浏览器打开 DeepSeek Harness 官网 */
function openOfficialSite() {
  void nativeApi.shell.openExternal('https://www.deepseek.com/harness/')
}

/** 通过系统文件选择框选择 dsh 可执行文件 */
async function chooseFile() {
  const files = await nativeApi.dialog.open({properties: ['openFile']})
  if (files && files.length > 0) {
    pathInput.value = files[0]
  }
}

async function verify() {
  verifying.value = true
  try {
    await store.saveDshPath(pathInput.value.trim())
    if (store.dsh.state === 'ok') {
      MessageUtil.success(t('banner.verified', {version: store.dsh.version ?? ''}))
      // 校验通过，进入首页
      await router.replace('/profile')
    } else {
      MessageUtil.error(t('banner.invalid', {error: store.dsh.error ?? ''}))
    }
  } finally {
    verifying.value = false
  }
}

/** 打开安装弹窗：执行 `bun/npm install -g @deepseek-ai/dsh`，安装结束后自动重新检测并进入首页 */
function openInstall(bin: string) {
  const args = ['install', '-g', '@deepseek-ai/dsh']
  // Windows 下 npm 为 .cmd 脚本，需经 cmd /c 执行
  const command = /\.(cmd|bat)$/i.test(bin) ? 'cmd' : bin
  const cmdArgs = command === 'cmd' ? ['/c', bin, ...args] : args
  openInstallDsh({
    command,
    args: cmdArgs,
    onSuccess: () => router.replace('/profile')
  })
}

/** 重新检测 dsh 命令是否已可用（如刚通过 bun / npm 安装完成） */
async function refresh() {
  refreshing.value = true
  try {
    await Promise.all([store.resolveDsh(), detectTools()])
    if (store.dsh.state === 'ok') {
      MessageUtil.success(t('banner.verified', {version: store.dsh.version ?? ''}))
      // 检测通过，进入首页
      await router.replace('/profile')
    } else {
      MessageUtil.error(t('banner.invalid', {error: store.dsh.error ?? ''}))
    }
  } finally {
    refreshing.value = false
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

      .tool-missing {
        font-size: 12px;
        color: var(--td-text-color-placeholder);
      }

      .setup-links {
        display: flex;
        justify-content: center;
      }
    }

    .setup-refresh {
      margin-top: 16px;
      display: flex;
      justify-content: center;
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

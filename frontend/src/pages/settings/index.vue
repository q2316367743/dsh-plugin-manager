<template>
  <SubPageLayout :title="t('settings.title')">
    <t-card class="settings-card">
      <t-form layout="vertical" label-align="top" class="settings-form">
        <t-form-item :label="t('settings.dshPath')" :help="t('settings.dshPathHint')">
          <div class="flex gap-8px w-full">
            <t-input v-model="dshPath" :placeholder="t('banner.placeholder')" clearable class="flex-1" />
            <t-button variant="outline" @click="chooseFile">
              <template #icon><folder-icon /></template>
              {{ t('settings.chooseFile') }}
            </t-button>
          </div>
        </t-form-item>
        <t-form-item :label="t('settings.port')">
          <t-input-number v-model="port" :min="1" :max="65535" />
        </t-form-item>
        <t-form-item :label="t('settings.theme')">
          <t-radio-group v-model="theme">
            <t-radio-button value="light">{{ t('settings.themeLight') }}</t-radio-button>
            <t-radio-button value="dark">{{ t('settings.themeDark') }}</t-radio-button>
            <t-radio-button value="system">{{ t('settings.themeSystem') }}</t-radio-button>
          </t-radio-group>
        </t-form-item>
        <t-form-item :label="t('settings.language')">
          <t-radio-group v-model="lang">
            <t-radio-button value="zh">中文</t-radio-button>
            <t-radio-button value="en">English</t-radio-button>
          </t-radio-group>
        </t-form-item>
        <t-form-item :label="t('settings.confirmRestart')" :help="t('settings.confirmRestartHint')">
          <t-switch v-model="confirmRestart" />
        </t-form-item>
        <t-button theme="primary" @click="save">{{ t('common.save') }}</t-button>
      </t-form>
    </t-card>
  </SubPageLayout>
</template>
<script lang="ts" setup>
import { FolderIcon } from 'tdesign-icons-vue-next'
import { useDshStore } from '@/store/dsh'
import { useI18n } from '@/i18n'
import { useColorMode } from '@/hooks'
import MessageUtil from '@/utils/modal/MessageUtil'
import { nativeApi } from '@/api/native'
import type { Lang, ThemeMode } from '@/types/dsh'

const store = useDshStore()
const { t, lang: langState, setLang } = useI18n()
const { mode, setMode } = useColorMode()

const dshPath = ref(store.settings.dshPath)
const port = ref(store.settings.port)
const theme = ref<ThemeMode>(mode.value)
const lang = ref<Lang>(langState.value)
const confirmRestart = ref(store.settings.confirmRestart)

// 主题 / 语言即时生效并持久化（各自模块负责存储）
watch(theme, (value) => setMode(value))
watch(lang, (value) => setLang(value))

/** 通过系统文件选择框选择 dsh 可执行文件 */
async function chooseFile() {
  const files = await nativeApi.dialog.open({ properties: ['openFile'] })
  if (files && files.length > 0) {
    dshPath.value = files[0]
  }
}

async function save() {
  await store.saveDshPath(dshPath.value.trim())
  store.saveSettings({ port: port.value, confirmRestart: confirmRestart.value })
  if (store.dsh.state === 'ok') {
    MessageUtil.success(t('banner.verified', { version: store.dsh.version ?? '' }))
  } else {
    MessageUtil.warning(t('banner.missing'))
  }
}
</script>
<style scoped lang="less">
.settings-card {
  margin: 16px;

  .settings-form {
    margin-top: 8px;
  }
}
</style>

<template>
  <div class="profile-page">
    <header class="page-header">
      <div class="page-header-left">
        <t-select
          :value="store.currentProfile"
          :options="profileOptions"
          class="profile-select"
          @change="onProfileChange"
        />
        <t-input
          v-model="store.filter"
          :placeholder="t('list.searchPlaceholder')"
          clearable
          class="search-input"
        >
          <template #prefix-icon><search-icon /></template>
        </t-input>
      </div>
      <div class="page-header-right">
        <t-button theme="primary" variant="text" shape="square" @click="router.push('/settings')">
          <template #icon><setting1-icon /></template>
        </t-button>
      </div>
    </header>

    <div class="page-body">
      <ServerCard v-if="store.hasWebApp" />

      <t-card class="toolbar">
        <div class="toolbar-row">
          <t-button
            theme="primary"
            :disabled="!store.dshOk || store.cliBusy"
            @click="openInstall"
          >
            <template #icon><add-icon /></template>
            {{ t('toolbar.install') }}
          </t-button>
          <t-button
            variant="outline"
            :disabled="!store.dshOk || store.cliBusy || checking"
            :loading="checking"
            @click="onCheckUpdates"
          >
            <template #icon><refresh-icon /></template>
            {{ t('toolbar.checkUpdates') }}
          </t-button>
          <t-button variant="outline" @click="onExport">
            <template #icon><upload-icon /></template>
            {{ t('toolbar.export') }}
          </t-button>
          <t-button variant="outline" @click="openImport">
            <template #icon><download-icon /></template>
            {{ t('toolbar.import') }}
          </t-button>
          <div class="flex-1" />
          <t-switch :value="store.pureMode" :disabled="store.cliBusy" @change="onPureMode">
            <template #label>{{ t('toolbar.pure') }}</template>
          </t-switch>
        </div>
      </t-card>

      <t-skeleton v-if="store.loading" :rows="5" class="skeleton" />

      <template v-else>
        <PluginGroup
          v-if="filteredOfficial.length"
          :title="`${t('list.official')}（${filteredOfficial.length}）`"
          :items="filteredOfficial"
          @toggle="onToggle"
          @action="onAction"
        />
        <PluginGroup
          v-if="filteredThird.length"
          :title="`${t('list.thirdParty')}（${filteredThird.length}）`"
          :items="filteredThird"
          @toggle="onToggle"
          @action="onAction"
        />
        <t-empty v-if="!store.detail?.items.length" :description="t('list.empty')" class="empty" />
        <t-empty
          v-else-if="!filteredOfficial.length && !filteredThird.length"
          :description="t('list.noMatch')"
          class="empty"
        />
      </template>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router'
import {
  AddIcon,
  DownloadIcon,
  RefreshIcon,
  SearchIcon,
  Setting1Icon,
  UploadIcon
} from 'tdesign-icons-vue-next'
import ServerCard from './components/ServerCard.vue'
import PluginGroup from './components/PluginGroup.vue'
import { useDshStore } from '@/store/dsh'
import { useI18n } from '@/i18n'
import type { I18nKey } from '@/i18n'
import MessageUtil from '@/utils/modal/MessageUtil'
import MessageBoxUtil from '@/utils/modal/MessageBoxUtil'
import { openInstallPlugin } from './modals/InstallPlugin'
import { openPluginConfig } from './modals/PluginConfig'
import { openImportProfile } from './modals/ImportProfile'
import { nativeApi } from '@/api/native'
import type { BundleItem } from '@/types/dsh'

const store = useDshStore()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const checking = ref(false)

const profileOptions = computed(() =>
  store.profiles.map((name) => ({ label: name, value: name }))
)

const filteredOfficial = computed(() => filterItems(store.officialBundles))
const filteredThird = computed(() => filterItems(store.thirdPartyBundles))

function filterItems(list: BundleItem[]): BundleItem[] {
  const keyword = store.filter.trim().toLowerCase()
  if (!keyword) return list
  return list.filter(
    (item) =>
      item.name.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword)
  )
}

function onProfileChange(value: unknown) {
  const name = String(value ?? '')
  if (name && name !== store.currentProfile) {
    router.replace(`/profile/${name}`)
  }
}

watch(
  () => route.params.name,
  (name) => {
    if (typeof name === 'string' && name !== store.currentProfile) {
      store.selectProfile(name)
    }
  }
)

onMounted(async () => {
  const name = route.params.name
  if (typeof name === 'string' && name !== store.currentProfile) {
    await store.selectProfile(name)
  }
})

// ---- 工具栏 ----
function openInstall() {
  openInstallPlugin({ profile: store.currentProfile })
}

function openImport() {
  openImportProfile({ profile: store.currentProfile })
}

async function onCheckUpdates() {
  checking.value = true
  try {
    const count = await store.checkUpdates()
    if (count > 0) {
      MessageUtil.success(t('toolbar.updatesFound', { count }))
    } else {
      MessageUtil.info(t('toolbar.noUpdates'))
    }
  } finally {
    checking.value = false
  }
}

async function onExport() {
  const path = await store.exportProfile()
  if (path) MessageUtil.success(t('export.saved', { path }))
}

async function onPureMode(on: boolean | string | number) {
  const enabled = !!on
  await store.setPureMode(enabled)
  if (store.server.status === 'stopped' || store.server.status === 'unknown') {
    // 服务未运行：无需重启，直接反馈状态
    MessageUtil.success(enabled ? t('toolbar.pureOn') : t('toolbar.pureOff'))
    return
  }
  await promptRestart(enabled ? 'pure-on' : 'pure-off')
}

// ---- 插件卡片操作 ----
async function onToggle(item: BundleItem, enabled: boolean) {
  await store.toggleBundle(item, enabled)
  promptRestart(enabled ? 'enabled' : 'disabled', item.name)
}

function onAction(item: BundleItem, value: string) {
  switch (value) {
    case 'config':
      openPluginConfig({ profile: store.currentProfile, bundle: item })
      break
    case 'update':
      doUpdate(item)
      break
    case 'homepage':
      openHomepage(item)
      break
    case 'remove':
      doRemove(item)
      break
  }
}

function openHomepage(item: BundleItem) {
  const url = item.homepage || item.repository
  if (url) void nativeApi.shell.openExternal(url)
}

async function doRemove(item: BundleItem) {
  try {
    await MessageBoxUtil.confirm(t('plugin.removeConfirm', { name: item.name }), t('plugin.remove'))
  } catch {
    return
  }
  let tail = ''
  MessageUtil.info(t('plugin.removing', { name: item.name }))
  const ok = await store.removeBundle(item, (chunk) => (tail += chunk))
  if (ok) {
    MessageUtil.success(t('plugin.removed', { name: item.name }))
    promptRestart('removed', item.name)
  } else {
    MessageUtil.error(t('plugin.removeFailed', { error: tail.slice(-300) }))
  }
}

type RestartAction = 'enabled' | 'disabled' | 'removed' | 'pure-on' | 'pure-off'

/**
 * 启用 / 禁用 / 卸载 / 切换纯净模式后，若 web 服务在运行则询问是否立即重启。
 * 设置中关闭「不再提示」后静默跳过；外部启动的服务提示手动重启。
 */
async function promptRestart(action: RestartAction, name?: string) {
  const status = store.server.status
  if (status === 'stopped' || status === 'unknown') return
  if (!store.settings.confirmRestart) return
  if (status === 'running-foreign') {
    MessageUtil.info(t('restart.foreign'))
    return
  }
  const actionKey: Record<RestartAction, I18nKey> = {
    enabled: 'restart.actionEnabled',
    disabled: 'restart.actionDisabled',
    removed: 'restart.actionRemoved',
    'pure-on': 'restart.actionPureOn',
    'pure-off': 'restart.actionPureOff'
  }
  const actionText = actionKey[action]
  const isPure = action === 'pure-on' || action === 'pure-off'
  let restart = false
  try {
    await MessageBoxUtil.confirm(
      isPure
        ? t('restart.confirmPure', { action: t(actionText) })
        : t('restart.confirm', { action: t(actionText), name: name ?? '' }),
      t('restart.title'),
      {
        confirmButtonText: t('restart.now'),
        cancelButtonText: t('restart.later')
      }
    )
    restart = true
  } catch {
    /* 用户选择稍后 */
  }
  if (!restart) {
    MessageUtil.info(t('restart.deferred'))
    return
  }
  MessageUtil.info(t('restart.restarting'))
  await store.restartServer()
  MessageUtil.success(t('restart.done'))
}

async function doUpdate(item: BundleItem) {
  let tail = ''
  MessageUtil.info(t('plugin.updating', { name: item.name }))
  const ok = await store.updateBundle(item, (chunk) => (tail += chunk))
  if (ok) MessageUtil.success(t('plugin.updated', { name: item.name }))
  else MessageUtil.error(t('plugin.updateFailed', { error: tail.slice(-300) }))
}
</script>
<style scoped lang="less">
.profile-page {
  height: 100%;
  display: flex;
  flex-direction: column;

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 56px;
    flex-shrink: 0;
    // Acrylic glass material — Fluent Design
    background-color: color-mix(in srgb, var(--td-bg-color-container) 72%, transparent);
    backdrop-filter: blur(30px) saturate(150%);
    -webkit-backdrop-filter: blur(30px) saturate(150%);
    border-bottom: 1px solid var(--td-border-level-1-color);

    .page-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;

      .profile-select {
        width: 200px;
      }

      .search-input {
        width: 240px;
      }
    }
  }

  .page-body {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;

    .toolbar {
      .toolbar-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
    }

    .skeleton {
      padding: 16px;
    }

    .empty {
      margin-top: 48px;
    }
  }
}
</style>

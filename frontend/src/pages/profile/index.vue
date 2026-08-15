<template>
  <div class="profile-page">
    <div class="server-wrap">
      <ServerCard/>
    </div>

    <header class="page-header">
      <div class="page-header-left">
        <t-select
          :value="store.currentProfile"
          :options="profileOptions"
          class="profile-select"
        >
          <template #panelBottomContent>
            <div class="p-8px" style="border-top: 1px solid var(--td-border-level-1-color)">
              <t-button
                variant="text"
                block
                :loading="refreshing"
                @click="refreshProfiles"
              >
                <template #icon>
                  <refresh-icon/>
                </template>
                {{ t('list.refresh') }}
              </t-button>
            </div>
          </template>
        </t-select>
        <t-input
          v-model="store.filter"
          :placeholder="t('list.searchPlaceholder')"
          clearable
          class="search-input"
        >
          <template #prefix-icon>
            <search-icon/>
          </template>
        </t-input>
      </div>
      <div class="page-header-right">
        <t-button
          theme="primary"
          :disabled="!store.dshOk || store.cliBusy"
          @click="openInstall"
        >
          <template #icon>
            <add-icon/>
          </template>
          {{ t('toolbar.install') }}
        </t-button>
        <t-button variant="outline" @click="openSettingsYaml">
          <template #icon>
            <setting-icon/>
          </template>
          {{ t('toolbar.globalSettings') }}
        </t-button>
      </div>
    </header>

    <div class="page-body">
      <t-skeleton v-if="store.loading" :rows="5" class="skeleton"/>

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
        >
          <template #actions>
            <t-switch :value="store.pureMode" :disabled="store.cliBusy" @change="onPureMode">
              <template #label>{{ t('toolbar.pure') }}</template>
            </t-switch>
          </template>
        </PluginGroup>
        <t-empty v-if="!store.detail?.items.length" :description="t('list.empty')" class="empty"/>
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
import {AddIcon, RefreshIcon, SearchIcon, SettingIcon} from 'tdesign-icons-vue-next'
import ServerCard from './components/ServerCard.vue'
import PluginGroup from './components/PluginGroup.vue'
import {useDshStore} from '@/store/dsh'
import {useI18n} from '@/i18n'
import MessageUtil from '@/utils/modal/MessageUtil'
import MessageBoxUtil from '@/utils/modal/MessageBoxUtil'
import {openInstallPlugin} from './modals/InstallPlugin'
import {openUpdatePlugin} from './modals/UpdatePlugin'
import {openPluginConfig} from './modals/PluginConfig'
import {openSettingsYaml} from './modals/SettingsYaml'
import {promptRestart} from './restart'
import {nativeApi} from '@/api/native'
import type {BundleItem} from '@/types/dsh'

const store = useDshStore()
const {t} = useI18n()

const profileOptions = computed(() =>
  store.profiles.map((name) => ({label: name, value: name}))
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

const refreshing = ref(false)

/** 重新获取 profile 列表（新建 profile 后无需重启即可在下拉中看到） */
async function refreshProfiles() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await store.refreshProfiles()
    MessageUtil.success(t('list.refreshDone'))
  } catch {
    MessageUtil.error(t('list.refreshFailed'))
  } finally {
    refreshing.value = false
  }
}

// ---- 工具栏 ----
function openInstall() {
  openInstallPlugin({profile: store.currentProfile})
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
      openPluginConfig({profile: store.currentProfile, bundle: item})
      break
    case 'update':
      openUpdatePlugin({profile: store.currentProfile, item})
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
    await MessageBoxUtil.confirm(t('plugin.removeConfirm', {name: item.name}), t('plugin.remove'))
  } catch {
    return
  }
  let tail = ''
  MessageUtil.info(t('plugin.removing', {name: item.name}))
  const ok = await store.removeBundle(item, (chunk) => (tail += chunk))
  if (ok) {
    MessageUtil.success(t('plugin.removed', {name: item.name}))
    promptRestart('removed', item.name)
  } else {
    MessageUtil.error(t('plugin.removeFailed', {error: tail.slice(-300)}))
  }
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
    padding: 0 16px 16px;
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

    .page-header-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
  }

  .server-wrap {
    flex-shrink: 0;
    padding: 16px;
  }

  .page-body {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;

    .skeleton {
      padding: 16px;
    }

    .empty {
      margin-top: 48px;
    }
  }
}
</style>

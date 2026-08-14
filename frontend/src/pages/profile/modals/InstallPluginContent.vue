<template>
  <div class="install">
    <t-tabs v-model="tab">
      <t-tab-panel value="npm" :label="t('install.tabNpm')">
        <t-input
          v-model="npmQuery"
          :placeholder="t('install.npmPlaceholder')"
          clearable
        >
          <template #prefix-icon><search-icon /></template>
        </t-input>
      </t-tab-panel>
      <t-tab-panel value="github" :label="t('install.tabGithub')">
        <t-input
          v-model="githubQuery"
          :placeholder="t('install.githubPlaceholder')"
          clearable
        >
          <template #prefix-icon><search-icon /></template>
        </t-input>
      </t-tab-panel>
      <t-tab-panel value="direct" :label="t('install.tabDirect')">
        <div class="direct-row">
          <t-input
            v-model="directSpec"
            :placeholder="t('install.directPlaceholder')"
            clearable
            @enter="installFromDirect"
          />
          <t-button
            theme="primary"
            :disabled="!directSpec.trim() || store.cliBusy"
            @click="installFromDirect"
          >
            {{ t('install.install') }}
          </t-button>
        </div>
      </t-tab-panel>
    </t-tabs>

    <!-- 搜索结果 -->
    <div v-if="stage === 'search'" class="results">
      <div v-if="searching" class="center">
        <t-loading :loading="true" text="" />
      </div>
      <template v-else>
        <t-empty v-if="!results.length" :description="t('install.empty')" />
        <div v-for="hit in results" :key="hitKey(hit)" class="result-row">
          <div class="result-info">
            <div class="result-title">
              <span class="result-name">{{ hitKey(hit) }}</span>
              <t-tag size="small" variant="outline">{{ hitVersion(hit) }}</t-tag>
            </div>
            <div class="result-desc">{{ hit.description }}</div>
            <div v-if="isGithub(hit)" class="result-meta">
              ⭐ {{ hit.stargazers }}
            </div>
          </div>
          <t-button
            theme="primary"
            variant="outline"
            size="small"
            :disabled="store.cliBusy"
            @click="installHit(hit)"
          >
            {{ t('install.install') }}
          </t-button>
        </div>
      </template>
    </div>

    <!-- 安装日志 -->
    <div v-else class="install-view">
      <div class="install-header">
        <t-button variant="text" @click="backToSearch">
          <template #icon><chevron-left-icon /></template>
          {{ t('install.back') }}
        </t-button>
        <t-tag :theme="stage === 'done' ? 'success' : stage === 'failed' ? 'danger' : 'warning'">
          {{ stageText }}
        </t-tag>
      </div>
      <pre class="log-area">{{ logs }}</pre>
      <div class="install-footer">
        <t-button v-if="stage === 'done'" theme="primary" @click="emit('close')">
          {{ t('install.done') }}
        </t-button>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ChevronLeftIcon, SearchIcon } from 'tdesign-icons-vue-next'
import { dshApi } from '@/api/dsh'
import { useDshStore } from '@/store/dsh'
import { useI18n } from '@/i18n'
import MessageUtil from '@/utils/modal/MessageUtil'
import type { GithubSearchHit, NpmSearchHit } from '@/types/dsh'

const props = defineProps<{ profile: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useDshStore()
const { t } = useI18n()

type Stage = 'search' | 'installing' | 'done' | 'failed'
type Hit = NpmSearchHit | GithubSearchHit

const tab = ref<'npm' | 'github' | 'direct'>('npm')
const npmQuery = ref('')
const githubQuery = ref('')
const directSpec = ref('')
const results = ref<Hit[]>([])
const searching = ref(false)
const stage = ref<Stage>('search')
const logs = ref('')
const lastInstalled = ref('')

const stageText = computed(() => {
  switch (stage.value) {
    case 'done':
      return t('install.installed', { name: lastInstalled.value })
    case 'failed':
      return t('install.failed')
    default:
      return t('install.installing')
  }
})

const searchNpm = useDebounceFn(async () => {
  const query = npmQuery.value.trim()
  if (!query) {
    results.value = []
    return
  }
  searching.value = true
  try {
    results.value = await dshApi.searchNpm(query)
  } catch (error) {
    MessageUtil.error(t('install.error', { error: errorText(error) }))
  } finally {
    searching.value = false
  }
}, 400)

const searchGithub = useDebounceFn(async () => {
  const query = githubQuery.value.trim()
  searching.value = true
  try {
    results.value = await dshApi.searchGithub(query)
  } catch (error) {
    MessageUtil.error(t('install.error', { error: errorText(error) }))
  } finally {
    searching.value = false
  }
}, 400)

watch(tab, (value) => {
  if (value === 'npm') {
    results.value = []
    if (npmQuery.value.trim()) searchNpm()
  } else if (value === 'github') {
    results.value = []
    searchGithub()
  } else {
    results.value = []
  }
})

watch(npmQuery, () => {
  if (tab.value === 'npm') searchNpm()
})

watch(githubQuery, () => {
  if (tab.value === 'github') searchGithub()
})

function hitKey(hit: Hit): string {
  return (hit as NpmSearchHit).name ?? (hit as GithubSearchHit).fullName
}

function isGithub(hit: Hit): hit is GithubSearchHit {
  return 'fullName' in hit
}

function hitVersion(hit: Hit): string {
  return (hit as NpmSearchHit).version ?? 'GitHub'
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function installHit(hit: Hit) {
  const name = hitKey(hit)
  const spec = (hit as NpmSearchHit).name
    ? name
    : `github:${(hit as GithubSearchHit).fullName}`
  await runInstall(spec, name)
}

async function installFromDirect() {
  const spec = directSpec.value.trim()
  if (!spec) return
  const name = spec.split('@')[0].split('/').pop() ?? spec
  await runInstall(spec, name)
}

async function runInstall(spec: string, name: string) {
  stage.value = 'installing'
  logs.value = ''
  lastInstalled.value = name
  const ok = await store.installBundle(spec, (chunk) => (logs.value += chunk))
  stage.value = ok ? 'done' : 'failed'
}

function backToSearch() {
  stage.value = 'search'
  logs.value = ''
}
</script>
<style scoped lang="less">
.install {
  display: flex;
  flex-direction: column;
  height: 100%;

  .direct-row {
    display: flex;
    gap: 8px;
  }

  .results {
    flex: 1;
    overflow: auto;
    margin-top: 12px;

    .center {
      display: flex;
      justify-content: center;
      padding: 48px 0;
    }

    .result-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: var(--td-radius-default);

      &:hover {
        background-color: var(--td-bg-color-secondarycontainer);
      }

      .result-info {
        flex: 1;
        min-width: 0;

        .result-title {
          display: flex;
          align-items: center;
          gap: 6px;

          .result-name {
            font-weight: 600;
            color: var(--td-text-color-primary);
          }
        }

        .result-desc {
          margin-top: 2px;
          font-size: 12px;
          color: var(--td-text-color-secondary);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .result-meta {
          margin-top: 2px;
          font-size: 12px;
          color: var(--td-text-color-placeholder);
        }
      }
    }
  }

  .install-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-top: 12px;
    min-height: 0;

    .install-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .log-area {
      flex: 1;
      min-height: 0;
      margin: 0;
      padding: 8px 12px;
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

    .install-footer {
      display: flex;
      justify-content: flex-end;
      padding-top: 12px;
    }
  }
}
</style>

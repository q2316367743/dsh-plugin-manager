<template>
  <div class="app-root">
    <router-view />
  </div>
</template>
<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router'
import { useDshStore } from '@/store/dsh'

const route = useRoute()
const router = useRouter()
const store = useDshStore()

/**
 * 统一入口路由：
 * - dsh 未就绪 → 全屏引导页 /setup
 * - dsh 就绪且停留在引导页 / 根路径 → 进入当前 profile 首页
 */
function ensureRoute() {
  const dshReady = store.dsh.state === 'ok'
  const path = route.path
  if (!dshReady && path !== '/setup') {
    router.replace('/setup')
    return
  }
  if (dshReady && (path === '/setup' || path === '/' || path === '/home')) {
    router.replace(store.currentProfile ? `/profile/${store.currentProfile}` : '/settings')
  }
}

onMounted(async () => {
  // store 已在 main.ts bootstrap 中 init；此处兜底（如热更新重载）
  if (!store.profiles.length) await store.init()
  ensureRoute()

  window.preload.inject.onPluginEnter((action) => {
    // utools 主输入框文本作为子输入框初始过滤词
    if (action.type === 'text' && typeof action.payload === 'string') {
      store.filter = action.payload
    }
    // 每次进入静默刷新数据并重新判定入口
    store.init()
    ensureRoute()
  })
})
</script>
<style scoped lang="less">
.app-root {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>

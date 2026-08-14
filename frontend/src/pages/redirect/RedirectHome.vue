<template>
  <div class="redirect-home" />
</template>
<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { useDshStore } from '@/store/dsh'

// '/' 兜底：dsh 未就绪进引导页，否则进当前 profile 首页（store 已在 bootstrap 中 init）
const router = useRouter()
const store = useDshStore()

onMounted(() => {
  if (store.dsh.state !== 'ok') {
    router.replace('/setup')
  } else {
    router.replace('/profile')
  }
})
</script>

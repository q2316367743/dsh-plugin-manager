<template>
  <img :src :alt="alt" />
</template>
<script lang="ts" setup>
const props = defineProps({
  url: String,
  alt: String
})

const src = ref('')

onMounted(async () => {
  // 先把之前的干掉
  if (src.value) {
    URL.revokeObjectURL(src.value)
    src.value = ''
  }
  const { url } = props
  if (!url) return
  const unit8Array = await window.preload.inject.db.promises.getAttachment(url)
  if (!unit8Array) return
  src.value = URL.createObjectURL(new Blob([unit8Array.buffer as ArrayBuffer]))
})
onBeforeUnmount(() => {
  if (src.value) {
    URL.revokeObjectURL(src.value)
  }
})
</script>
<style scoped lang="less"></style>

<template>
  <div ref="containerRef" class="code-editor" :style="{ height }"></div>
</template>

<script lang="ts" setup>
import { monaco } from '@/plugin/monaco'
import { useColorMode } from '@/hooks'

const props = withDefaults(
  defineProps<{
    modelValue: string
    language: 'json' | 'yaml'
    readonly?: boolean
    height?: string
  }>(),
  { readonly: false, height: '320px' }
)

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const containerRef = ref<HTMLDivElement | null>(null)
const { isDark } = useColorMode()

let editor: monaco.editor.IStandaloneCodeEditor | null = null
let model: monaco.editor.ITextModel | null = null
let applyingExternal = false

/** 外部传入值变化时同步进编辑器（如切换行后重新加载配置） */
function syncValue() {
  if (!model || model.getValue() === props.modelValue) return
  applyingExternal = true
  model.setValue(props.modelValue)
  applyingExternal = false
}

function applyTheme() {
  monaco.editor.setTheme(isDark.value ? 'vs-dark' : 'vs')
}

onMounted(() => {
  if (!containerRef.value) return
  model = monaco.editor.createModel(props.modelValue, props.language)
  editor = monaco.editor.create(containerRef.value, {
    model,
    theme: isDark.value ? 'vs-dark' : 'vs',
    readOnly: props.readonly,
    fontSize: 13,
    minimap: { enabled: true },
    tabSize: 2,
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,

  })
  editor.onDidChangeModelContent(() => {
    if (applyingExternal) return
    emit('update:modelValue', editor?.getValue() ?? '')
  })
})

watch(() => props.modelValue, syncValue)
watch(() => props.language, (language) => model && monaco.editor.setModelLanguage(model, language))
watch(isDark, applyTheme)

onBeforeUnmount(() => {
  editor?.dispose()
  model?.dispose()
})
</script>

<style scoped lang="less">
.code-editor {
  width: 100%;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-medium);
  overflow: hidden;
}
</style>

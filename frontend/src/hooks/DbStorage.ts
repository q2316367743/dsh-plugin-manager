import { isNull } from '@/utils/lang/FieldUtil'
import { KeyValueUtil } from '@/utils/native'
import { cloneDeep } from 'es-toolkit'

type initialValueFunc<T> = () => T
type initialValue<T> = T | initialValueFunc<T>

/**
 * 持久化 ref：内存态即时响应，写入异步落库（Wails KV 服务）。
 * 初始化时异步加载持久化值并回填，触发 watch 生效（如主题切换）。
 */
export function useDbStorage<T extends string | number | boolean | Record<string, any>>(
  key: string,
  initial: initialValue<T>
): Ref<T> {
  const init = () => (typeof initial === 'function' ? (initial as initialValueFunc<T>)() : initial)
  const state = ref<T>(init())

  void KeyValueUtil.getItem<T>(key).then((res) => {
    if (!isNull(res) && res !== undefined) {
      state.value = res
    }
  })

  return customRef((track, trigger) => ({
    get() {
      track()
      return state.value
    },
    set(value) {
      let raw: unknown
      try {
        raw = toRaw(value)
      } catch {
        raw = cloneDeep(value)
      }
      state.value = value
      void KeyValueUtil.setItem(key, raw as T)
      trigger()
    }
  }))
}

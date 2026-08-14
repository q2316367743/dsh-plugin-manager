import { isNull } from '@/utils/lang/FieldUtil'
import { KeyValueUtil } from '@/utils/native'
import { cloneDeep } from 'es-toolkit'

type initialValueFunc<T> = () => T
type initialValue<T> = T | initialValueFunc<T>

/**
 * 异步对象存储
 */
export function useUtoolsDbStorage<T extends string | number | boolean | Record<string, any>>(
  key: string,
  initial: initialValue<T>
): Ref<T> {
  return customRef((track, trigger) => ({
    get() {
      track()
      let res = KeyValueUtil.getItem(key)
      if (isNull(res)) {
        return typeof initial === 'function' ? initial() : initial
      }
      return res
    },
    set(value) {
      try {
        KeyValueUtil.setItem(key, toRaw(value))
      } catch (e) {
        KeyValueUtil.setItem(key, cloneDeep(value))
      }
      trigger()
    }
  }))
}

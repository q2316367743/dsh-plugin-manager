import { nativeApi } from '@/api/native'

export const KeyValueUtil = {
  getItem: <T>(key: string): Promise<T | null> => nativeApi.kv.getItem<T>(key),
  setItem: <T>(key: string, value: T): Promise<void> => nativeApi.kv.setItem(key, value),
  removeItem: (key: string): Promise<void> => nativeApi.kv.removeItem(key)
}

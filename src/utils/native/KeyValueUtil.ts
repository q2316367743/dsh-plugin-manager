export const KeyValueUtil = {
  getItem: <T>(key: string): T | null => {
    return window.preload.inject.dbStorage.getItem(key) as T | null
  },
  setItem: <T>(key: string, value: T) => {
    window.preload.inject.dbStorage.setItem(key, value)
  },
  removeItem: (key: string) => {
    window.preload.inject.dbStorage.removeItem(key)
  }
}

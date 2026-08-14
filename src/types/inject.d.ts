/**
 * utools API 注入类型声明 —— 与 src-utools/src/inject.js 运行时注入面保持一致。
 * 仅声明前端实际用到的 API；新增注入时在此同步补充。
 */

interface InjectShell {
  openExternal(url: string): void
}

interface InjectDialog {
  open(options?: {
    title?: string
    defaultPath?: string
    buttonLabel?: string
    filters?: { name: string; extensions: string[] }[]
    properties?: Array<
      | 'openFile'
      | 'openDirectory'
      | 'multiSelections'
      | 'showHiddenFiles'
      | 'createDirectory'
      | 'promptToCreate'
      | 'noResolveAliases'
      | 'treatPackageAsDirectory'
      | 'dontAddToRecent'
    >
    message?: string
    securityScopedBookmarks?: boolean
  }): string[] | undefined

  save(options?: {
    title?: string
    defaultPath?: string
    buttonLabel?: string
    filters?: { name: string; extensions: string[] }[]
    message?: string
    nameFieldLabel?: string
    showsTagField?: string
    properties?: Array<
      | 'showHiddenFiles'
      | 'createDirectory'
      | 'treatPackageAsDirectory'
      | 'showOverwriteConfirmation'
      | 'dontAddToRecent'
    >
    securityScopedBookmarks?: boolean
  }): string | undefined
}

interface InjectClipboard {
  copyText(text: string): boolean
}

interface InjectDbStorage {
  setItem(key: string, value: any): void
  getItem<T = any>(key: string): T
  removeItem(key: string): void
}

interface InjectApi {
  shell: InjectShell
  dialog: InjectDialog
  clipboard: InjectClipboard
  dbStorage: InjectDbStorage
}

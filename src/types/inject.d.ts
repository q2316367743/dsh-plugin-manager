interface InjectAiModel {
  id: string
  label: string
  description: string
  icon: string
  cost: number
}

interface InjectAiMessage {
  role: 'system' | 'user' | 'assistant'
  content?: string
  reasoning_content?: string
}

interface InjectAiTool {
  type: 'function'
  function?: {
    name: string
    description: string
    parameters: Record<string, any>
    required?: string[]
  }
}

interface InjectAiOption {
  model?: string
  messages: InjectAiMessage[]
  tools?: InjectAiTool[]
}

interface InjectAiResult<T> extends Promise<T> {
  abort(): void
}

type InjectDbDoc<T extends Record<string, any> = Record<string, any>> = {
  _id: string
  _rev?: string
} & T

interface InjectDbReturn {
  id: string
  rev?: string
  ok?: boolean
  error?: boolean
  name?: string
  message?: string
}

interface InjectFfmpegProgress {
  bitrate: string
  fps: number
  frame: number
  percent?: number
  q: number | string
  size: string
  speed: string
  time: string
}

interface InjectFfmpegPromise extends Promise<void> {
  kill(): void
  quit(): void
}

interface InjectMainPushResult {
  icon?: string
  text: string
  title?: string
}

interface InjectPluginFeature {
  code: string
  explain?: string
  platform?: 'darwin' | 'win32' | 'linux' | Array<'darwin' | 'win32' | 'linux'>
  icon?: string
  cmds: (
    | string
    | {
        type: 'img' | 'files' | 'regex' | 'over' | 'window'
        label: string
      }
  )[]
  mainHide?: boolean
  mainPush?: boolean
}

interface InjectShell {
  openExternal(url: string): void
  openPath(fullPath: string): void
  trashItem(filename: string): Promise<void>
  showItemInFolder(fullPath: string): void
  beep(): void
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
  copyFile(file: string | string[]): boolean
  copyImage(img: string | Uint8Array): boolean
  getCopyedFiles(): { isFile: boolean; isDirectory: boolean; name: string; path: string }[]
}

interface InjectOs {
  isDarkColors(): boolean
  isMacOS(): boolean
  isWindows(): boolean
  isLinux(): boolean
  isDev(): boolean
  /**
   * 获取当前登录用户信息。
   * @platform ZTools 不支持，返回 null
   */
  getUser(): { avatar: string; nickname: string; type: string } | null
  getNativeId(): string
  getAppVersion(): string
  getAppName(): string
  getPath(
    name:
      | 'home'
      | 'appData'
      | 'userData'
      | 'cache'
      | 'temp'
      | 'exe'
      | 'module'
      | 'desktop'
      | 'documents'
      | 'downloads'
      | 'music'
      | 'pictures'
      | 'videos'
      | 'logs'
      | 'pepperFlashSystemPlugin'
  ): string
  getFileIcon(filePath: string): string
  getCursorScreenPoint(): { x: number; y: number }
}

interface InjectDisplay {
  getPrimaryDisplay(): {
    id: number
    internal: boolean
    monochrome: boolean
    rotation: number
    scaleFactor: number
    touchSupport: 'available' | 'unavailable' | 'unknown'
    accelerometerSupport: 'available' | 'unavailable' | 'unknown'
    colorDepth: number
    colorSpace: string
    depthPerComponent: number
    size: { width: number; height: number }
    workArea: { width: number; height: number }
    workAreaSize: { width: number; height: number }
    bounds: { x: number; y: number; width: number; height: number }
  }

  getAllDisplays(): {
    id: number
    internal: boolean
    monochrome: boolean
    rotation: number
    scaleFactor: number
    touchSupport: 'available' | 'unavailable' | 'unknown'
    accelerometerSupport: 'available' | 'unavailable' | 'unknown'
    colorDepth: number
    colorSpace: string
    depthPerComponent: number
    size: { width: number; height: number }
    workArea: { width: number; height: number }
    workAreaSize: { width: number; height: number }
    bounds: { x: number; y: number; width: number; height: number }
  }[]

  getDisplayNearestPoint(point: { x: number; y: number }): {
    id: number
    bounds: { x: number; y: number; width: number; height: number }
    size: { width: number; height: number }
    workArea: { width: number; height: number }
    workAreaSize: { width: number; height: number }
    scaleFactor: number
    rotation: number
    internal: boolean
  }

  getDisplayMatching(rect: { x: number; y: number; width: number; height: number }): {
    id: number
    bounds: { x: number; y: number; width: number; height: number }
    size: { width: number; height: number }
    workArea: { width: number; height: number }
    workAreaSize: { width: number; height: number }
    scaleFactor: number
    rotation: number
  }

  screenToDipPoint(point: { x: number; y: number }): { x: number; y: number }
  dipToScreenPoint(point: { x: number; y: number }): { x: number; y: number }
  screenToDipRect(rect: { x: number; y: number; width: number; height: number }): {
    x: number
    y: number
    width: number
    height: number
  }
  dipToScreenRect(rect: { x: number; y: number; width: number; height: number }): {
    x: number
    y: number
    width: number
    height: number
  }
  desktopCaptureSources(options: {
    types: string[]
    thumbnailSize?: { width: number; height: number }
    fetchWindowIcons?: boolean
  }): Promise<{
    appIcon: Record<string, any>
    display_id: string
    id: string
    name: string
    thumbnail: Record<string, any>
  }>
}

interface InjectWindow {
  hideMainWindow(isRestorePreWindow?: boolean): boolean
  showMainWindow(): boolean
  setExpendHeight(height: number): boolean
  getWindowType(): 'main' | 'detach' | 'browser'
  hideMainWindowTypeString(str: string): void
  hideMainWindowPasteFile(file: string | string[]): void
  hideMainWindowPasteImage(img: string | Uint8Array): void
  hideMainWindowPasteText(text: string): void
  startDrag(file: string | string[]): void
}

interface InjectBrowser {
  createBrowserWindow(
    url: string,
    options: {
      title?: string
      width?: number
      height?: number
      x?: number
      y?: number
      minWidth?: number
      minHeight?: number
      maxWidth?: number
      maxHeight?: number
      resizable?: boolean
      movable?: boolean
      minimizable?: boolean
      maximizable?: boolean
      closable?: boolean
      alwaysOnTop?: boolean
      fullscreen?: boolean
      fullscreenable?: boolean
      skipTaskbar?: boolean
      frame?: boolean
      transparent?: boolean
      backgroundColor?: string
      hasShadow?: boolean
      titleBarStyle?: 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover'
      thickFrame?: boolean
      vibrancy?: string
      zoomToPageWidth?: boolean
      webPreferences?: {
        preload?: string
        nodeIntegration?: boolean
        contextIsolation?: boolean
        enableRemoteModule?: boolean
      }
    },
    callback?: () => void
  ): {
    id: number
    close(): void
    focus(): void
    blur(): void
    isFocused(): boolean
    isDestroyed(): boolean
    show(): void
    hide(): void
    setSize(width: number, height: number): void
    setPosition(x: number, y: number): void
    reload(): void
    loadURL(url: string): void
    on(event: string, callback: (...args: any[]) => void): void
  }

  sendToParent(channel: string, ...params: any[]): void
  findInPage(
    text: string,
    options?: {
      forward?: boolean
      findNext?: boolean
      matchCase?: boolean
      wordStart?: boolean
      medialCapitalAsWordStart?: boolean
    }
  ): void
  stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void
}

interface InjectInput {
  setSubInput(
    onChange: (input: { text: string }) => void,
    placeholder?: string,
    isFocus?: boolean
  ): boolean
  removeSubInput(): boolean
  setSubInputValue(value: string): boolean
  subInputFocus(): boolean
  subInputSelect(): boolean
  subInputBlur(): boolean
}

interface InjectSimulate {
  keyboardTap(
    key: string,
    ...modifier: ('control' | 'ctrl' | 'shift' | 'option' | 'alt' | 'command' | 'super')[]
  ): void
  mouseClick(x?: number, y?: number): void
  mouseRightClick(x?: number, y?: number): void
  mouseDoubleClick(x?: number, y?: number): void
  mouseMove(x: number, y: number): void
}

interface InjectNotification {
  show(body: string, featureName?: string): void
}

interface InjectFeature {
  set(feature: InjectPluginFeature): boolean
  remove(code: string): boolean
  get(codes?: string[]): InjectPluginFeature[]
}

interface InjectPurchase {
  open(
    options: {
      goodsId: string
      outOrderId?: string
      attach?: string
    },
    callback?: () => void
  ): void

  pay(
    options: {
      goodsId: string
      outOrderId?: string
      attach?: string
    },
    callback?: () => void
  ): void

  getPayments(): Promise<
    {
      order_id: string
      total_fee: number
      body: string
      attach: string
      goods_id: string
      out_order_id: string
      paid_at: string
    }[]
  >

  isPurchased(): boolean
  getServerToken(): Promise<{ token: string; expiredAt: number }>
}

interface InjectRedirect {
  to(
    label: string | string[],
    payload: string | { type: 'text' | 'img' | 'files'; data: any }
  ): boolean
  hotKeySetting(cmdLabel: string, autocopy?: boolean): void
  aiModelsSetting(): void
}

interface InjectScreen {
  colorPick(callback: (color: { hex: string; rgb: string }) => void): void
  capture(callback: (imgBase64: string) => void): void
}

interface InjectAi {
  allModels(): Promise<InjectAiModel[]>
  chat(
    option: InjectAiOption,
    streamCallback: (chunk: InjectAiMessage) => void
  ): InjectAiResult<void>
  chat(option: InjectAiOption): InjectAiResult<InjectAiMessage>
}

interface InjectFfmpeg {
  run(args: string[], onProgress?: (progress: InjectFfmpegProgress) => void): InjectFfmpegPromise
}

interface InjectDbPromises {
  put(doc: InjectDbDoc): Promise<InjectDbReturn>
  get<T extends Record<string, any> = Record<string, any>>(
    id: string
  ): Promise<InjectDbDoc<T> | null>
  remove(doc: string | InjectDbDoc): Promise<InjectDbReturn>
  bulkDocs(docs: InjectDbDoc[]): Promise<InjectDbReturn[]>
  allDocs<T extends Record<string, any> = Record<string, any>>(
    key?: string
  ): Promise<InjectDbDoc<T>[]>
  postAttachment(docId: string, attachment: Uint8Array, type: string): Promise<InjectDbReturn>
  getAttachment(docId: string): Promise<Uint8Array | null>
  getAttachmentType(docId: string): Promise<string | null>
  replicateStateFromCloud(): Promise<null | 0 | 1>
}

interface InjectDb {
  put(doc: InjectDbDoc): InjectDbReturn
  get<T extends Record<string, any> = Record<string, any>>(id: string): InjectDbDoc<T> | null
  remove(doc: string | InjectDbDoc): InjectDbReturn
  bulkDocs(docs: InjectDbDoc[]): InjectDbReturn[]
  allDocs<T extends Record<string, any> = Record<string, any>>(key?: string): InjectDbDoc<T>[]
  postAttachment(docId: string, attachment: Uint8Array, type: string): InjectDbReturn
  getAttachment(docId: string): Uint8Array | null
  getAttachmentType(docId: string): string | null
  replicateStateFromCloud(): null | 0 | 1
  promises: InjectDbPromises
}

interface InjectDbStorage {
  setItem(key: string, value: any): void
  getItem<T = any>(key: string): T
  removeItem(key: string): void
}

interface InjectDbCryptoStorage {
  setItem(key: string, value: any): void
  getItem<T = any>(key: string): T
  removeItem(key: string): void
}

interface InjectTeam {
  info(): {
    teamId: string
    teamName: string
    teamLogo: string
    userId: string
    userName: string
    userAvatar: string
  }
  preset<T = any>(key: string): T
  allPresets(): Promise<{ key: string; value: any }[]>
}

interface InjectApi {
  getPlatform(): 'ZTools' | 'utools' | 'browser'

  shell: InjectShell
  dialog: InjectDialog
  clipboard: InjectClipboard
  os: InjectOs
  display: InjectDisplay
  window: InjectWindow
  browser: InjectBrowser
  input: InjectInput
  simulate: InjectSimulate
  notification: InjectNotification
  feature: InjectFeature
  purchase: InjectPurchase
  redirect: InjectRedirect
  screen: InjectScreen
  ai: InjectAi
  ffmpeg: InjectFfmpeg
  db: InjectDb
  dbStorage: InjectDbStorage
  dbCryptoStorage: InjectDbCryptoStorage
  team: InjectTeam

  onPluginEnter<T = any, L = any>(
    callback: (action: {
      code: string
      type: string
      payload: T
      option: L
      from?: 'main' | 'panel' | 'hotkey' | 'redirect'
    }) => void
  ): void

  onPluginOut(callback: (processExit: boolean) => void): void
  onPluginDetach(callback: () => void): void

  onDbPull<T extends Record<string, any> = Record<string, any>>(
    callback: (docs: InjectDbDoc<T>[]) => void
  ): void

  onMainPush<T = any>(
    callback: (action: {
      code: string
      type: string
      payload: T
    }) => InjectMainPushResult[] | Promise<InjectMainPushResult[]>,
    selectCallback: (action: {
      code: string
      type: string
      payload: any
      option: InjectMainPushResult
    }) => void
  ): void

  outPlugin(isKill?: boolean): boolean
  readCurrentFolderPath(): Promise<string>
  readCurrentBrowserUrl(): Promise<string>
}

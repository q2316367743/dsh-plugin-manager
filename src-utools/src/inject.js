const platform = window.ztools ? 'ZTools' : window.utools ? 'utools' : 'browser'

const api = window.ztools || window.utools

module.exports = {
  getPlatform: () => platform,

  shell: {
    openExternal: (url) => api.shellOpenExternal(url),
    openPath: (fullPath) => api.shellOpenPath(fullPath),
    trashItem: (filename) => api.shellTrashItem(filename),
    showItemInFolder: (fullPath) => api.shellShowItemInFolder(fullPath),
    beep: () => api.shellBeep(),
  },

  dialog: {
    open: (options) => api.showOpenDialog(options),
    save: (options) => api.showSaveDialog(options),
  },

  clipboard: {
    copyText: (text) => api.copyText(text),
    copyFile: (file) => api.copyFile(file),
    copyImage: (img) => api.copyImage(img),
    getCopyedFiles: () => api.getCopyedFiles(),
  },

  os: {
    isDarkColors: () => api.isDarkColors(),
    isMacOS: () => api.isMacOS(),
    isWindows: () => api.isWindows(),
    isLinux: () => api.isLinux(),
    isDev: () => api.isDev(),
    getUser: () => api.getUser(),
    getNativeId: () => api.getNativeId(),
    getAppVersion: () => api.getAppVersion(),
    getAppName: () => api.getAppName(),
    getPath: (name) => api.getPath(name),
    getFileIcon: (filePath) => api.getFileIcon(filePath),
    getCursorScreenPoint: () => api.getCursorScreenPoint(),
  },

  display: {
    getPrimaryDisplay: () => api.getPrimaryDisplay(),
    getAllDisplays: () => api.getAllDisplays(),
    getDisplayNearestPoint: (point) => api.getDisplayNearestPoint(point),
    getDisplayMatching: (rect) => api.getDisplayMatching(rect),
    screenToDipPoint: (point) => api.screenToDipPoint(point),
    dipToScreenPoint: (point) => api.dipToScreenPoint(point),
    screenToDipRect: (rect) => api.screenToDipRect(rect),
    dipToScreenRect: (rect) => api.dipToScreenRect(rect),
    desktopCaptureSources: (options) => api.desktopCaptureSources(options),
  },

  window: {
    hideMainWindow: (isRestorePreWindow) => api.hideMainWindow(isRestorePreWindow),
    showMainWindow: () => api.showMainWindow(),
    setExpendHeight: (height) => api.setExpendHeight(height),
    getWindowType: () => api.getWindowType(),
    hideMainWindowTypeString: (str) => api.hideMainWindowTypeString(str),
    hideMainWindowPasteFile: (file) => api.hideMainWindowPasteFile(file),
    hideMainWindowPasteImage: (img) => api.hideMainWindowPasteImage(img),
    hideMainWindowPasteText: (text) => api.hideMainWindowPasteText(text),
    startDrag: (file) => api.startDrag(file),
  },

  browser: {
    createBrowserWindow: (url, options, callback) => api.createBrowserWindow(url, options, callback),
    sendToParent: (channel, ...params) => api.sendToParent(channel, ...params),
    findInPage: (text, options) => api.findInPage(text, options),
    stopFindInPage: (action) => api.stopFindInPage(action),
  },

  input: {
    setSubInput: (onChange, placeholder, isFocus) => api.setSubInput(onChange, placeholder, isFocus),
    removeSubInput: () => api.removeSubInput(),
    setSubInputValue: (value) => api.setSubInputValue(value),
    subInputFocus: () => api.subInputFocus(),
    subInputSelect: () => api.subInputSelect(),
    subInputBlur: () => api.subInputBlur(),
  },

  simulate: {
    keyboardTap: (key, ...modifier) => api.simulateKeyboardTap(key, ...modifier),
    mouseClick: (x, y) => api.simulateMouseClick(x, y),
    mouseRightClick: (x, y) => api.simulateMouseRightClick(x, y),
    mouseDoubleClick: (x, y) => api.simulateMouseDoubleClick(x, y),
    mouseMove: (x, y) => api.simulateMouseMove(x, y),
  },

  notification: {
    show: (body, featureName) => api.showNotification(body, featureName),
  },

  feature: {
    set: (feature) => api.setFeature(feature),
    remove: (code) => api.removeFeature(code),
    get: (codes) => api.getFeatures(codes),
  },

  purchase: {
    open: (options, callback) => api.openPurchase(options, callback),
    pay: (options, callback) => api.openPayment(options, callback),
    getPayments: () => api.fetchUserPayments(),
    isPurchased: () => api.isPurchasedUser(),
    getServerToken: () => api.fetchUserServerTemporaryToken(),
  },

  redirect: {
    to: (label, payload) => api.redirect(label, payload),
    hotKeySetting: (cmdLabel, autocopy) => api.redirectHotKeySetting(cmdLabel, autocopy),
    aiModelsSetting: () => api.redirectAiModelsSetting(),
  },

  screen: {
    colorPick: (callback) => api.screenColorPick(callback),
    capture: (callback) => api.screenCapture(callback),
  },

  ai: {
    allModels: () => api.allAiModels(),
    chat: (option, streamCallback) => {
      if (streamCallback) {
        return api.ai(option, streamCallback)
      }
      return api.ai(option)
    },
  },

  ffmpeg: {
    run: (args, onProgress) => api.runFFmpeg(args, onProgress),
  },

  db: api?.db,
  dbStorage: api?.dbStorage,
  dbCryptoStorage: api?.dbCryptoStorage,
  team: api?.team,

  onPluginEnter: (callback) => api.onPluginEnter(callback),
  onPluginOut: (callback) => api.onPluginOut(callback),
  onPluginDetach: (callback) => api.onPluginDetach(callback),
  onDbPull: (callback) => api.onDbPull(callback),
  onMainPush: (callback, selectCallback) => api.onMainPush(callback, selectCallback),
  outPlugin: (isKill) => api.outPlugin(isKill),
  readCurrentFolderPath: () => api.readCurrentFolderPath(),
  readCurrentBrowserUrl: () => api.readCurrentBrowserUrl(),
}

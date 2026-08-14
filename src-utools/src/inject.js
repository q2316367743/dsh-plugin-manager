/**
 * utools API 注入层（仅保留前端实际用到的 API）。
 * 新增需求时按需在此扩展，并在 src/types/inject.d.ts 同步类型。
 */
const api = window.ztools || window.utools

module.exports = {
  shell: {
    openExternal: (url) => api.shellOpenExternal(url),
  },

  dialog: {
    open: (options) => api.showOpenDialog(options),
    save: (options) => api.showSaveDialog(options),
  },

  clipboard: {
    copyText: (text) => api.copyText(text),
  },

  dbStorage: api?.dbStorage,
}

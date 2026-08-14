const net = require('./src/net')
const inject = require('./src/inject')
const dsh = require('./src/dsh')
const proc = require('./src/process')
const file = require('./src/file')

if (window.ztools) window.utools = window.ztools

window.preload = {
  getPlatform: () => {
    if (window.ztools) {
      return 'ZTools'
    } else if (window.utools) {
      return 'utools'
    }
    return 'browser'
  },
  net,
  inject,
  dsh,
  proc,
  file
}

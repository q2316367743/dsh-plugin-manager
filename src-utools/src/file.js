/**
 * 通用文件读写（preload Node 环境）。
 * 用于导出 / 导入 profile 视图等场景。
 */
const { readFileSync, writeFileSync } = require('node:fs')

module.exports = {
  readTextFile: (path) => readFileSync(path, 'utf8'),
  writeTextFile: (path, content) => writeFileSync(path, content)
}

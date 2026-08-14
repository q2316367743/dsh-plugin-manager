/**
 * dsh 生态访问层：DSH_HOME 解析、profile 清单读写、cordis patch 读写、
 * bundle 行 id 解析、已安装包信息、dsh 可执行文件解析与校验。
 * 所有函数在 preload（Node）环境执行，页面侧经 window.preload.dsh 调用。
 */
const { homedir, platform } = require('node:os')
const { join } = require('node:path')
const {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  accessSync,
  constants
} = require('node:fs')
const { spawnSync } = require('node:child_process')
const { userEnv } = require('./process')

const DSH_HOME_DIR_NAME = '.dsh'
const PROFILE_PATCH_FILENAME = 'cordis.patch.yml'

/** $DSH_HOME：显式配置 > $DSH_HOME 环境变量 > ~/.dsh */
function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  return join(homedir(), DSH_HOME_DIR_NAME)
}

function profilesDir() {
  return join(resolveDshHome(), 'profiles')
}

/** 列出所有 profile（目录下存在 package.json 视为一个 profile） */
function listProfiles() {
  const dir = profilesDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'package.json')))
    .map((entry) => entry.name)
    .sort()
}

function profileDir(profile) {
  return join(profilesDir(), profile)
}

function readProfileManifest(profile) {
  const file = join(profileDir(profile), 'package.json')
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeProfileManifest(profile, manifest) {
  const file = join(profileDir(profile), 'package.json')
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n')
}

function profilePatchPath(profile) {
  return join(profileDir(profile), PROFILE_PATCH_FILENAME)
}

/** 读取 profile 级 cordis.patch.yml 原文；不存在时返回空串 */
function readProfilePatch(profile) {
  const file = profilePatchPath(profile)
  if (!existsSync(file)) return ''
  return readFileSync(file, 'utf8')
}

function writeProfilePatch(profile, content) {
  const file = profilePatchPath(profile)
  writeFileSync(file, content)
}

/**
 * 解析某个 bundle 在 profile 中的安装目录。
 * pnpm 的 hoisted 结构下，@deepseek-ai/* 位于 profiles/node_modules，
 * 第三方包位于 profiles/<profile>/node_modules，两处兜底。
 */
function resolveBundleDir(profile, packageName) {
  const candidates = [
    join(profileDir(profile), 'node_modules', packageName),
    join(profilesDir(), 'node_modules', packageName)
  ]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'package.json'))) return candidate
  }
  return null
}

/** 读取已安装包（bundle 或普通依赖）的 package.json */
function readInstalledPackage(profile, packageName) {
  const dir = resolveBundleDir(profile, packageName)
  if (!dir) return null
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
}

/** 读取 bundle 自带 patch（dsh.bundle.patch 指向的文件）原文 */
function readBundlePatch(profile, packageName) {
  const dir = resolveBundleDir(profile, packageName)
  if (!dir) return null
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
  const patchRel = manifest.dsh?.bundle?.patch
  if (!patchRel) return null
  const patchFile = join(dir, patchRel)
  if (!existsSync(patchFile)) return null
  return readFileSync(patchFile, 'utf8')
}

function isExecutable(file) {
  try {
    accessSync(file, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** 解析 dsh 可执行文件：手动配置 > PATH > ~/.bun/bin（bun 全局安装目录） */
function resolveDshBin(configuredPath) {
  if (configuredPath) {
    if (existsSync(configuredPath) && isExecutable(configuredPath)) return configuredPath
    return null
  }
  const fromPath = findOnPath('dsh')
  if (fromPath) return fromPath
  const bunBin = join(homedir(), '.bun', 'bin', platform() === 'win32' ? 'dsh.exe' : 'dsh')
  if (existsSync(bunBin) && isExecutable(bunBin)) return bunBin
  return null
}

/** 在 PATH 上查找可执行文件（通用） */
function findOnPath(name) {
  const pathVar = process.env.PATH || ''
  const delimiter = platform() === 'win32' ? ';' : ':'
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue
    for (const candidate of platform() === 'win32'
      ? [`${name}.exe`, `${name}.cmd`, `${name}.bat`]
      : [name]) {
      const file = join(dir, candidate)
      if (existsSync(file) && isExecutable(file)) return file
    }
  }
  return null
}

/** 查找 bun 可执行文件（bun 安装的 dsh 无 node 时用它兜底解释执行） */
function findBun() {
  const bunBin = join(homedir(), '.bun', 'bin', platform() === 'win32' ? 'bun.exe' : 'bun')
  if (existsSync(bunBin) && isExecutable(bunBin)) return bunBin
  return findOnPath('bun')
}

/**
 * 探测 dsh 的实际运行方式：
 * 1. 直接执行（注入用户 PATH，shebang 的 env node 可解析）；
 * 2. 失败（常见于只装 bun 未装 node）→ 用 bun 解释执行。
 * @returns {{ok: boolean, command?: string, prefix?: string[], version?: string, error?: string}}
 */
function probeDsh(binPath) {
  const opts = { encoding: 'utf8', timeout: 10000, env: userEnv() }
  const direct = spawnSync(binPath, ['--version'], opts)
  if (!direct.error && direct.status === 0) {
    return {
      ok: true,
      command: binPath,
      prefix: [],
      version: (direct.stdout || '').trim().split('\n')[0] || 'unknown'
    }
  }
  // 直接执行失败：尝试 bun 解释执行（bun 兼容 node 脚本）
  const bun = findBun()
  if (bun) {
    const viaBun = spawnSync(bun, [binPath, '--version'], opts)
    if (!viaBun.error && viaBun.status === 0) {
      return {
        ok: true,
        command: bun,
        prefix: [binPath],
        version: (viaBun.stdout || '').trim().split('\n')[0] || 'unknown'
      }
    }
  }
  const reason = (direct.stderr || direct.error?.message || '').trim().slice(0, 200)
  return { ok: false, error: reason || `exit code ${direct.status}` }
}

/**
 * 解析并探测 dsh：手动配置 > PATH > ~/.bun/bin，随后探测运行方式。
 * @returns {{state: 'ok'|'missing'|'invalid', path?: string, command?: string, prefix?: string[], version?: string, error?: string}}
 */
function resolveDsh(configuredPath) {
  const binPath = resolveDshBin(configuredPath)
  if (!binPath) {
    return configuredPath
      ? { state: 'invalid', path: configuredPath, error: 'file-not-found' }
      : { state: 'missing' }
  }
  const probed = probeDsh(binPath)
  if (!probed.ok) {
    return { state: 'invalid', path: binPath, error: probed.error }
  }
  return {
    state: 'ok',
    path: binPath,
    command: probed.command,
    prefix: probed.prefix,
    version: probed.version
  }
}

module.exports = {
  getDshHome: resolveDshHome,
  listProfiles,
  readProfileManifest,
  writeProfileManifest,
  readProfilePatch,
  writeProfilePatch,
  readBundlePatch,
  readInstalledPackage,
  resolveDshBin,
  resolveDsh
}

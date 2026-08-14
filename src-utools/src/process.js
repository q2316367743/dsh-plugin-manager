/**
 * 进程与端口工具：流式启动子进程、杀进程、存活检测、端口探测。
 * 用于启动/停止 dsh web 服务与执行 dsh plugin 安装命令。
 *
 * 重要：utools（macOS GUI 应用）从 launchd 继承的基础 PATH 不含用户 shell 的
 * 自定义路径（nvm / ~/.bun/bin / homebrew 等），导致 `#!/usr/bin/env node`
 * 之类的 shebang 找不到解释器。所有 spawn 统一注入用户登录 shell 的 PATH。
 */
const { spawn, spawnSync } = require('node:child_process')
const net = require('node:net')
const { platform } = require('node:os')

let cachedUserPath = null

/**
 * 提取用户登录 shell 的完整 PATH（macOS/Linux）。
 * 依次尝试 zsh / bash 登录交互模式，取 stdout 最后一行，失败回退 process.env.PATH。
 */
function resolveUserPath() {
  if (cachedUserPath) return cachedUserPath
  if (platform() === 'win32') {
    return (cachedUserPath = process.env.PATH || '')
  }
  const shells = [
    ['/bin/zsh', '-lic'],
    ['/bin/bash', '-lic']
  ]
  for (const [shell, flag] of shells) {
    try {
      const res = spawnSync(shell, [flag, 'echo $PATH'], {
        encoding: 'utf8',
        timeout: 8000
      })
      if (res.status === 0 && res.stdout) {
        const lines = res.stdout.trim().split('\n')
        const last = lines[lines.length - 1]?.trim()
        if (last && last.includes('/')) {
          return (cachedUserPath = last)
        }
      }
    } catch {
      /* 尝试下一个 shell */
    }
  }
  return (cachedUserPath = process.env.PATH || '')
}

/** 注入用户 PATH 的进程环境 */
function userEnv(extra = {}) {
  return { ...process.env, ...extra, PATH: resolveUserPath() }
}

/**
 * 流式启动子进程。
 * @param {string} cmd 命令
 * @param {string[]} args 参数
 * @param {{cwd?: string, env?: object, detached?: boolean}} options
 * @param {{onStdout?: (chunk: string) => void, onStderr?: (chunk: string) => void, onExit?: (r: {code: number|null, signal: string|null}) => void, onError?: (e: Error) => void}} handlers
 * @returns {{pid: number|undefined}} 进程句柄
 */
function spawnStream(cmd, args, options = {}, handlers = {}) {
  const child = spawn(cmd, args, {
    cwd: options.cwd,
    env: userEnv(options.env),
    detached: options.detached === true,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: platform() === 'win32'
  })
  child.stdout?.on('data', (chunk) => handlers.onStdout?.(chunk.toString()))
  child.stderr?.on('data', (chunk) => handlers.onStderr?.(chunk.toString()))
  child.on('error', (err) => handlers.onError?.(err))
  child.on('exit', (code, signal) => handlers.onExit?.({ code, signal }))
  return { pid: child.pid }
}

/**
 * 杀进程：SIGTERM 后等待退出，3s 内未退出则 SIGKILL 兜底。
 * @returns {Promise<boolean>} 进程是否已消失
 */
function kill(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve(false)
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      return resolve(false)
    }
    const start = Date.now()
    const timer = setInterval(() => {
      let alive = true
      try {
        process.kill(pid, 0)
      } catch {
        alive = false
      }
      if (!alive) {
        clearInterval(timer)
        return resolve(true)
      }
      if (Date.now() - start > 3000) {
        clearInterval(timer)
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          /* 已退出 */
        }
        resolve(true)
      }
    }, 200)
  })
}

/** PID 是否存活 */
function isAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** TCP 探测端口是否可连接 */
function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    socket.setTimeout(1500)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

/** 通过 lsof（darwin/linux）找到监听某端口的 PID；win32 暂不支持返回 null */
function findPidByPort(port) {
  if (platform() === 'win32') return null
  try {
    const res = spawnSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
    if (res.status !== 0) return null
    const line = (res.stdout || '').trim().split('\n')[0]
    const pid = Number(line)
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

module.exports = {
  spawnStream,
  kill,
  isAlive,
  checkPort,
  findPidByPort,
  resolveUserPath,
  userEnv
}

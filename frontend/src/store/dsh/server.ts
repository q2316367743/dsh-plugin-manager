/**
 * dsh web 服务启停逻辑（从 store/dsh 拆分，控制主文件行数）。
 * busy 互斥由公开函数统一管理：restartServer 全程持有 busy，
 * 保证重启期间启动/停止按钮持续禁用；refreshServerStatus 保留 busy，
 * 避免轮询刷新状态时把 busy 重置为 false 导致按钮提前可点。
 */
import { Events } from '@wailsio/runtime'
import { dshApi } from '@/api/dsh'
import { nativeApi } from '@/api/native'
import { KeyValueUtil } from '@/utils/native'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import type { useDshStore } from './index'

type DshStore = ReturnType<typeof useDshStore>

/** web 服务进程输出事件负载（对应 Go 侧 services.ProcOutput） */
interface ProcOutputPayload {
  jobId: string
  stream: string
  text: string
}

function serverKey(profile: string): string {
  return `${LocalNameEnum.KEY_DSH_SERVER}/${profile}`
}

/** 是否已挂载 web 服务日志监听（仅挂载一次） */
let serverLogAttached = false

/** 挂载 web 服务日志监听（proc:output 事件，按 serverJobId 匹配累积 logTail） */
export function attachServerLog(store: DshStore) {
  if (serverLogAttached) return
  serverLogAttached = true
  Events.On('proc:output', (ev: { data: ProcOutputPayload }) => {
    const payload = ev.data
    if (store.serverJobId && payload.jobId === store.serverJobId) {
      store.server.logTail = (store.server.logTail + payload.text).slice(-6000)
    }
  })
}

/**
 * 刷新服务状态。判定依据：
 * 1. 记录在案的启动 PID 仍存活 → 本管理器启动；
 * 2. 否则查端口监听者（lsof）→ 外部启动；
 * 3. 均无 → 未启动。
 * 不依赖 TCP 探测，避免系统代理劫持端口导致误报。
 * 注意：保留 busy，防止在启动/停止过程中被重置导致按钮提前可点。
 */
export async function refreshServerStatus(store: DshStore) {
  const port = store.settings.port
  const saved = await KeyValueUtil.getItem<{ pid?: number; port?: number }>(
    serverKey(store.currentProfile)
  )
  const recordedPid = saved?.pid
  const base = { port, logTail: store.server.logTail, busy: store.server.busy }
  if (recordedPid && (await dshApi.isAlive(recordedPid))) {
    store.server = { ...base, status: 'running-own', pid: recordedPid }
    return
  }
  const listeningPid = await dshApi.findPidByPort(port)
  if (listeningPid) {
    store.server = { ...base, status: 'running-foreign', pid: listeningPid }
    return
  }
  store.server = { ...base, status: 'stopped', pid: undefined }
}

/** 实际启动流程（调用方负责 busy 互斥） */
async function startServerInternal(store: DshStore) {
  const runner = store.dshCommand()
  if (!runner) return
  const port = store.settings.port
  // 已在运行则直接刷新状态
  await refreshServerStatus(store)
  if (store.server.status !== 'stopped') return
  // detached 启动 web 服务，日志经事件 proc:output 累积到 logTail
  const jobId = `server-${Date.now()}`
  store.serverJobId = jobId
  const pid = await dshApi.spawnStream(
    jobId,
    runner.command,
    // 固定启动 web
    [...runner.prefix, '--profile', 'web', '--port', String(port)],
    true
  )
  if (pid > 0) {
    await KeyValueUtil.setItem(serverKey(store.currentProfile), { pid, port })
  }
  // 等待端口监听就绪后刷新状态
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await refreshServerStatus(store)
    if (store.server.status !== 'stopped') break
    // 进程已退出且未监听端口 → 启动失败，提前结束
    if (pid > 0 && !(await dshApi.isAlive(pid))) break
  }
}

/** 实际停止流程（调用方负责 busy 互斥） */
async function stopServerInternal(store: DshStore) {
  const saved = await KeyValueUtil.getItem<{ pid?: number }>(serverKey(store.currentProfile))
  const recordedPid = saved?.pid ?? store.server.pid
  // 先杀记录的进程，再清残留监听者（dsh 可能 fork 子进程占端口）
  if (recordedPid && (await dshApi.isAlive(recordedPid))) {
    await dshApi.kill(recordedPid)
  }
  const listener = await dshApi.findPidByPort(store.settings.port)
  if (listener && listener !== recordedPid) {
    await dshApi.kill(listener)
  }
  await KeyValueUtil.removeItem(serverKey(store.currentProfile))
  store.serverJobId = ''
  await refreshServerStatus(store)
}

export async function startServer(store: DshStore) {
  if (store.server.busy) return
  store.server.busy = true
  try {
    await startServerInternal(store)
  } finally {
    store.server.busy = false
  }
}

export async function stopServer(store: DshStore) {
  if (store.server.busy) return
  store.server.busy = true
  try {
    await stopServerInternal(store)
  } finally {
    store.server.busy = false
  }
}

export function openServer(store: DshStore) {
  const url = `http://127.0.0.1:${store.settings.port}`
  if (store.settings.browserMode === 'builtin') {
    void nativeApi.browser.openInBuiltin(url, store.settings.builtinWidth, store.settings.builtinHeight)
  } else {
    void nativeApi.shell.openExternal(url)
  }
}

/** 重启 web 服务（仅对本管理器启动的服务生效），返回是否已重启 */
export async function restartServer(store: DshStore): Promise<boolean> {
  if (store.server.busy) return false
  if (store.server.status !== 'running-own') return false
  // 全程持有 busy：stop 与 start 之间无间隙，重启期间按钮保持禁用
  store.server.busy = true
  try {
    await stopServerInternal(store)
    await startServerInternal(store)
    return true
  } finally {
    store.server.busy = false
  }
}

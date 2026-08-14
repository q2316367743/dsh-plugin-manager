/**
 * 系统托盘桥接：把 web 服务运行状态回推给托盘菜单（tray:service-status），
 * 并响应托盘操作（tray:toggle-service 启停服务、tray:quit-request 退出前停服务）。
 * 事件协议与 Go 侧 services/tray.go（负载类型）及根目录 tray.go（托盘实现）对应。
 */
import { watch } from 'vue'
import { Events } from '@wailsio/runtime'
import { useDshStore } from '@/store/dsh'

/** tray:service-status 事件负载（对应 Go services.TrayServiceStatus） */
interface TrayServiceStatusPayload {
  running: boolean
  supported: boolean
}

/** 托盘桥接只挂载一次（避免 dev 热更新重复绑定） */
let trayBridgeAttached = false

export function useTray() {
  const store = useDshStore()

  if (trayBridgeAttached) return
  trayBridgeAttached = true

  // 服务状态变化（含 profile 切换后 hasWebApp 变化）→ 回推托盘，切换"启动/停止服务"标签与禁用态
  watch(
    [() => store.server.status, () => store.hasWebApp],
    () => {
      const status = store.server.status
      const payload: TrayServiceStatusPayload = {
        running: status === 'running-own' || status === 'running-foreign',
        supported: store.hasWebApp
      }
      Events.Emit('tray:service-status', payload)
    },
    { immediate: true }
  )

  // 托盘"启动/停止服务"：按当前状态切换（store 内部有 busy / dsh 守护）
  Events.On('tray:toggle-service', () => {
    const status = store.server.status
    if (status === 'running-own' || status === 'running-foreign') {
      void store.serverStop()
    } else {
      void store.serverStart()
    }
  })

  // 托盘"退出"：先停服务，确认后再由 Go 侧真正退出
  Events.On('tray:quit-request', async () => {
    await store.serverStop()
    Events.Emit('tray:quit-ready')
  })
}

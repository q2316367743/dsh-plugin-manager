/**
 * 托盘事件负载：前端把 dsh web 服务运行状态回推给托盘菜单，Go 侧据此切换
 * "启动服务 / 停止服务" 标签与禁用态、并联动"打开浏览器"菜单项可用性。
 * 本文件不承载逻辑，仅作为事件类型契约。
 * 事件清单：tray:toggle-service / tray:open-browser（Go→前端，无负载）、
 * tray:service-status（前端→Go，TrayServiceStatus）、tray:quit-request / tray:quit-ready（退出握手）。
 */
package services

// TrayServiceStatus 托盘"启动/停止服务"菜单项状态，经事件 "tray:service-status" 由前端推送给 Go。
// Running 表示当前 profile 的 web 服务是否在运行（本管理器启动或外部启动均可）；
// Supported 表示当前 profile 是否包含 dsh web 应用，不含时菜单项置灰。
type TrayServiceStatus struct {
	Running   bool `json:"running"`
	Supported bool `json:"supported"`
}

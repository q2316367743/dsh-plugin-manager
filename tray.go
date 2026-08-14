/**
 * 系统托盘（macOS 菜单栏）功能：显示/隐藏主窗口、启动/停止 dsh web 服务、退出。
 * 托盘与菜单在 Go 侧构建；"启动/停止服务"经事件路由到前端复用 Pinia store 的启停逻辑，
 * 前端通过 "tray:service-status" 回推状态，Go 据此切换菜单项标签与禁用态。
 * "退出"同样先经事件请前端停服务，前端确认（tray:quit-ready）后再真正退出，
 * 前端无响应时由 3 秒兜底定时器强制退出。
 */
package main

import (
	"context"
	_ "embed" // 供 //go:embed 托盘图标使用
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/updater"

	"dsh-plugin-manager/services"
)

//go:embed build/appicon.png
var trayIcon []byte

// setupTray 创建系统托盘并绑定菜单与事件；在 app.Run() 前调用。
// win 需保持存活（不要 Close/Destroy），"显示/隐藏"与"关闭到托盘"都依赖它。
func setupTray(app *application.App, win *application.WebviewWindow) {
	// 关闭到托盘：钩子在默认销毁监听之前执行，Cancel 阻止窗口销毁，仅隐藏。
	// 挂 Common.WindowClosing——各平台关闭事件经默认事件映射收敛到它
	// （Mac 红点/Cmd+W、Windows 关闭按钮、Linux WM 关闭），保证跨平台一致；
	// 若只挂 Mac.WindowShouldClose，Windows 上点关闭会销毁窗口并触发
	// "最后一个窗口关闭即退出"（PostQuitMessage），托盘随之消失。
	win.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		e.Cancel()
		win.Hide()
	})

	// 退出流程（只退一次）：请求前端停服务，前端确认或 3 秒超时后真正退出
	var quitOnce sync.Once
	quit := func() { quitOnce.Do(app.Quit) }
	app.Event.On("tray:quit-ready", func(*application.CustomEvent) { quit() })

	menu := application.NewMenu()
	menu.Add("显示/隐藏").OnClick(func(*application.Context) {
		if win.IsVisible() {
			win.Hide()
		} else {
			win.Show().Focus()
		}
	})
	// 启动/停止服务：标签随前端回推的状态切换，无 web 应用时置灰
	serviceItem := menu.Add("启动服务").OnClick(func(*application.Context) {
		app.Event.Emit("tray:toggle-service")
	})
	app.Event.On("tray:service-status", func(event *application.CustomEvent) {
		status, ok := event.Data.(services.TrayServiceStatus)
		if !ok {
			return
		}
		if status.Running {
			serviceItem.SetLabel("停止服务")
		} else {
			serviceItem.SetLabel("启动服务")
		}
		serviceItem.SetEnabled(status.Supported)
	})
	menu.AddSeparator()
	// 检查更新：手动触发一次完整更新流程（headless，应用启动后每 6 小时也会自动检查）；
	// 有更新时自动下载并暂存，就绪后前端弹重启确认；结果经 app:update-result 回传提示
	menu.Add("检查更新").OnClick(func(*application.Context) {
		go func() {
			if err := app.Updater.CheckAndInstall(context.Background()); err != nil {
				app.Event.Emit("app:update-result", map[string]string{"status": "error", "message": err.Error()})
				return
			}
			if app.Updater.State() == updater.StateUpToDate {
				app.Event.Emit("app:update-result", map[string]string{"status": "up-to-date"})
			}
		}()
	})
	menu.AddSeparator()
	menu.Add("退出").OnClick(func(*application.Context) {
		app.Event.Emit("tray:quit-request")
		time.AfterFunc(3*time.Second, quit)
	})

	tray := app.SystemTray.New()
	tray.SetIcon(trayIcon)
	tray.SetTooltip("dsh 助手")
	tray.SetMenu(menu)
}

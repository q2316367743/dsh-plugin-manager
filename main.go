/**
 * dsh 插件管理器 —— Wails v3 桌面应用入口。
 * 前端构建产物嵌入二进制（frontend/dist），注册三个 Go 服务供前端调用：
 * DshService（dsh 生态文件访问）/ ProcService（子进程与端口）/ KVService（应用键值存储）。
 */
package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"

	"dsh-plugin-manager/services"
)

//go:embed all:frontend/dist
var assets embed.FS

func init() {
	// 注册进程事件，绑定生成器会为前端生成强类型的事件订阅 API。
	application.RegisterEvent[services.ProcOutput]("proc:output")
	application.RegisterEvent[services.ProcExit]("proc:exit")
	// 注册托盘事件：启停请求（Go→前端）、服务状态回推（前端→Go）、退出握手（Go→前端 / 前端→Go）。
	application.RegisterEvent[application.Void]("tray:toggle-service")
	application.RegisterEvent[services.TrayServiceStatus]("tray:service-status")
	application.RegisterEvent[application.Void]("tray:quit-request")
	application.RegisterEvent[application.Void]("tray:quit-ready")
}

func main() {
	app := application.New(application.Options{
		Name:        "DSH Plugin Manager",
		Description: "按 profile 管理 dsh 插件的启停 / 安装 / 排序 / 纯净模式 / web 服务",
		Services: []application.Service{
			application.NewService(services.NewDshService()),
			application.NewService(services.NewProcService()),
			application.NewService(services.NewKVService()),
			application.NewService(services.NewBrowserService()),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			// 关闭主窗口不退出应用，转由托盘"显示/隐藏"找回（关闭到托盘）
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
	})

	win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "DSH Plugin Manager",
		Width:  1100,
		Height: 760,
		URL:    "/",
	})
	setupTray(app, win)

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}

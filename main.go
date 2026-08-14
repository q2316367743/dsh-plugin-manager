/**
 * dsh 插件管理器 —— Wails v3 桌面应用入口。
 * 前端构建产物嵌入二进制（frontend/dist），注册四个 Go 服务供前端调用：
 * DshService（dsh 生态文件访问）/ ProcService（子进程与端口）/
 * FileService（通用文件读写）/ KVService（应用键值存储）。
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
}

func main() {
	app := application.New(application.Options{
		Name:        "DSH Plugin Manager",
		Description: "按 profile 管理 dsh 插件的启停 / 安装 / 排序 / 纯净模式 / web 服务",
		Services: []application.Service{
			application.NewService(services.NewDshService()),
			application.NewService(services.NewProcService()),
			application.NewService(services.NewFileService()),
			application.NewService(services.NewKVService()),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "DSH Plugin Manager",
		Width:  1100,
		Height: 760,
		URL:    "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}

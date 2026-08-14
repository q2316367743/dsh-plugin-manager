/**
 * dsh 插件管理器 —— Wails v3 桌面应用入口。
 * 前端构建产物嵌入二进制（frontend/dist），注册四个 Go 服务供前端调用：
 * DshService（dsh 生态文件访问）/ ProcService（子进程与端口）/ KVService（应用键值存储）/ BrowserService（内置浏览器窗口）。
 * 应用自动更新：每 6 小时静默检查静态托管的应用更新清单（Wails Update Manifest 协议），
 * 新版本就绪后经事件通知前端确认重启（见 initUpdater）。
 */
package main

import (
	"context"
	"embed"
	"log"
	"time"

	"gopkg.in/yaml.v3"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/updater"
	"github.com/wailsapp/wails/v3/pkg/updater/providers/endpoint"

	"dsh-plugin-manager/services"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/config.yml
var projectConfig []byte

// updateManifestURL 是应用更新清单地址（静态托管，protocol 见 Wails docs "Update Manifest Protocol"）。
const updateManifestURL = "https://static.esion.xyz/public/static/wails/dsh-plugin-manager/update.json"

// publicKey 是更新签名验证的信任根（Ed25519 公钥，PEM / PKIX）。
// 由 `wails3 updater genkey` 生成；私钥 updater.key 仅保存在发布侧（CI secret / 密码管理器，勿入库）。
// 发布时 `wails3 updater sign -key updater.key <产物>` 签名 + `wails3 updater manifest` 生成
// 带 signature 的 manifest.json，应用端以此公钥验签（fail-closed：带签名但验签失败 / 无公钥则拒装）。
var publicKey = []byte(`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAL5VfyEHa80Z4XHgZYEKq5eJwypa1f3g6BOiYTSDJwHY=
-----END PUBLIC KEY-----`)

// appVersion 解析 build/config.yml 的 info.version，作为版本唯一来源：
// 发布新版本只需同步改 config.yml（构建产物随之嵌入新版本，避免升级后重复提示更新）。
func appVersion() string {
	var cfg struct {
		Info struct {
			Version string `yaml:"version"`
		} `yaml:"info"`
	}
	if err := yaml.Unmarshal(projectConfig, &cfg); err != nil {
		log.Printf("parse build/config.yml: %v", err)
		return ""
	}
	return cfg.Info.Version
}

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

// initUpdater 配置应用自动更新（headless）：每 6 小时后台检查更新清单，
// 发现新版本自动下载并暂存（不弹框架窗口），就绪后经 "app:update-ready" 通知前端确认重启。
func initUpdater(app *application.App) {
	provider, err := endpoint.New(endpoint.Config{
		URL: updateManifestURL,
	})
	if err != nil {
		log.Fatalf("updater endpoint provider: %v", err)
	}

	if err := app.Updater.Init(updater.Config{
		CurrentVersion: appVersion(),
		Providers:      []updater.Provider{provider},
		PublicKey:      publicKey,
		CheckInterval:  6 * time.Hour,
		Window:         updater.WindowNone,
	}); err != nil {
		log.Fatalf("updater init: %v", err)
	}

	// 更新已下载并暂存 → 请前端弹重启确认
	app.Event.On(updater.EventUpdateReady, func(*application.CustomEvent) {
		app.Event.Emit("app:update-ready")
	})
	// 前端确认重启 → helper 子进程完成二进制替换并重启（旧进程退出后生效）
	app.Event.On("app:update-restart", func(*application.CustomEvent) {
		go func() {
			if err := app.Updater.Restart(context.Background()); err != nil {
				app.Logger.Error("updater restart failed", "error", err)
			}
		}()
	})

	// 观察性日志：记录更新流程关键事件
	for _, name := range []string{
		updater.EventUpdateAvailable,
		updater.EventNoUpdate,
		updater.EventDownloadProgress,
		updater.EventUpdateReady,
		updater.EventError,
	} {
		evt := name
		app.Event.On(evt, func(e *application.CustomEvent) {
			app.Logger.Info("updater", "event", evt, "data", e.Data)
		})
	}
}

func main() {
	app := application.New(application.Options{
		Name:        "dsh 助手",
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

	initUpdater(app)

	win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "dsh 助手",
		Width:  1100,
		Height: 760,
		URL:    "/",
	})
	setupTray(app, win)

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}

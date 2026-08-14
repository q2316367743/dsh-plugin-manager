/**
 * 内置浏览器窗口：Wails v3 运行中新建 WebviewWindow 加载外部 URL（dsh web 页面）。
 * 前端按设置选择用系统默认浏览器（runtime Browser.OpenURL）或本服务打开。
 */
package services

import (
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// BrowserService 内置浏览器窗口管理（单例复用）。
type BrowserService struct {
	mu      sync.Mutex
	builtin *application.WebviewWindow
	url     string
}

func NewBrowserService() *BrowserService {
	return &BrowserService{}
}

// OpenInBuiltin 在内置浏览器窗口中打开 url；窗口已存在则按需更新地址并聚焦复用。
func (s *BrowserService) OpenInBuiltin(url string, width, height int) {
	app := application.Get()
	if app == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.builtin != nil {
		if url != s.url {
			s.builtin.SetURL(url)
			s.url = url
		}
		s.builtin.Focus()
		return
	}
	win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "DSH Web",
		Width:  width,
		Height: height,
		URL:    url,
	})
	s.builtin = win
	s.url = url
	win.OnWindowEvent(events.Common.WindowClosing, func(_ *application.WindowEvent) {
		s.mu.Lock()
		s.builtin = nil
		s.url = ""
		s.mu.Unlock()
	})
}

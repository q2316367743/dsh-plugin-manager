/**
 * 进程与端口服务：流式启动子进程、杀进程、存活检测、端口探测。
 * 用于启动/停止 dsh web 服务与执行 dsh plugin 安装命令。
 *
 * 重要：Wails（macOS GUI 应用）从 launchd 继承的基础 PATH 不含用户 shell 的
 * 自定义路径（nvm / ~/.bun/bin / homebrew 等），导致 `#!/usr/bin/env node`
 * 之类的 shebang 找不到解释器。所有 spawn 统一注入用户登录 shell 的 PATH。
 * 本文件为原 src-utools/src/process.js 的 Go 翻译，行为保持一致。
 */
package services

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ProcOutput CLI 流式输出事件负载，经事件 "proc:output" 推送给前端。
type ProcOutput struct {
	JobId  string `json:"jobId"`
	Stream string `json:"stream"` // stdout | stderr
	Text   string `json:"text"`
}

// ProcExit CLI 进程退出事件负载，经事件 "proc:exit" 推送给前端。
type ProcExit struct {
	JobId string `json:"jobId"`
	Code  int    `json:"code"`
}

var (
	userPathOnce   sync.Once
	cachedUserPath string
)

/**
 * 提取用户登录 shell 的完整 PATH（macOS/Linux）。
 * 依次尝试 zsh / bash 登录交互模式，取 stdout 最后一行，失败回退进程 PATH。
 */
func resolveUserPath() string {
	userPathOnce.Do(func() {
		if runtime.GOOS == "windows" {
			cachedUserPath = os.Getenv("PATH")
			return
		}
		shells := [][]string{
			{"/bin/zsh", "-lic"},
			{"/bin/bash", "-lic"},
		}
		for _, shell := range shells {
			ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
			out, err := exec.CommandContext(ctx, shell[0], shell[1], "echo $PATH").Output()
			cancel()
			if err != nil {
				continue
			}
			lines := strings.Split(strings.TrimSpace(string(out)), "\n")
			last := strings.TrimSpace(lines[len(lines)-1])
			if last != "" && strings.Contains(last, "/") {
				cachedUserPath = last
				return
			}
		}
		cachedUserPath = os.Getenv("PATH")
	})
	return cachedUserPath
}

/** 注入用户 PATH 的进程环境（PATH 固定取登录 shell PATH，extra 中的 PATH 忽略）。 */
func userEnv(extra map[string]string) []string {
	env := make([]string, 0, len(os.Environ())+len(extra)+1)
	for _, kv := range os.Environ() {
		if strings.HasPrefix(kv, "PATH=") {
			continue
		}
		env = append(env, kv)
	}
	env = append(env, "PATH="+resolveUserPath())
	for k, v := range extra {
		if k == "PATH" {
			continue
		}
		env = append(env, k+"="+v)
	}
	return env
}

// ProcService 进程与端口工具。
type ProcService struct{}

func NewProcService() *ProcService {
	return &ProcService{}
}

func (s *ProcService) emit(jobId, stream, text string) {
	application.Get().Event.Emit("proc:output", ProcOutput{JobId: jobId, Stream: stream, Text: text})
}

func (s *ProcService) emitExit(jobId string, code int) {
	application.Get().Event.Emit("proc:exit", ProcExit{JobId: jobId, Code: code})
}

/** 把流按块转发为事件（近似 node data chunk 语义，不等换行）。 */
func pump(r io.Reader, jobId, stream string, emit func(string, string, string)) {
	buf := make([]byte, 4096)
	for {
		n, err := r.Read(buf)
		if n > 0 {
			emit(jobId, stream, string(buf[:n]))
		}
		if err != nil {
			return
		}
	}
}

/**
 * 流式启动子进程（dsh CLI / web 服务）。
 * 输出经事件 "proc:output" 推送，进程退出后经 "proc:exit" 推送；
 * detached 时子进程脱离本进程组（父进程退出后继续运行）。
 * 立即返回子进程 pid，启动失败返回 -1。
 */
func (s *ProcService) RunCli(jobId string, cmd string, args []string, detached bool) int {
	c := exec.Command(cmd, args...)
	c.Env = userEnv(nil)
	if detached {
		c.SysProcAttr = detachedSysProcAttr()
	}
	stdout, err := c.StdoutPipe()
	if err != nil {
		s.emit(jobId, "stderr", "spawn error: "+err.Error()+"\n")
		s.emitExit(jobId, 1)
		return -1
	}
	stderr, err := c.StderrPipe()
	if err != nil {
		s.emit(jobId, "stderr", "spawn error: "+err.Error()+"\n")
		s.emitExit(jobId, 1)
		return -1
	}
	if err := c.Start(); err != nil {
		s.emit(jobId, "stderr", "spawn error: "+err.Error()+"\n")
		s.emitExit(jobId, 1)
		return -1
	}
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); pump(stdout, jobId, "stdout", s.emit) }()
	go func() { defer wg.Done(); pump(stderr, jobId, "stderr", s.emit) }()
	go func() {
		err := c.Wait()
		wg.Wait()
		code := 1
		if err == nil {
			code = 0
		} else if ee, ok := err.(*exec.ExitError); ok {
			code = ee.ExitCode()
		}
		s.emitExit(jobId, code)
	}()
	return c.Process.Pid
}

/** 杀进程：温和终止（SIGTERM / TerminateProcess）后等待退出，3s 内未退出则强杀兜底。 */
func (s *ProcService) Kill(pid int) bool {
	if pid <= 0 {
		return false
	}
	if !requestTerminate(pid) {
		return false
	}
	deadline := time.Now().Add(3 * time.Second)
	for {
		if !s.IsAlive(pid) {
			return true
		}
		if time.Now().After(deadline) {
			forceKill(pid)
			return true
		}
		time.Sleep(200 * time.Millisecond)
	}
}

/** PID 是否存活。 */
func (s *ProcService) IsAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	return procAlive(pid)
}

/** 通过 lsof（darwin/linux）找到监听某端口的 PID；win32 不支持返回 nil。 */
func (s *ProcService) FindPidByPort(port int) *int {
	if runtime.GOOS == "windows" {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "lsof", "-ti", fmt.Sprintf("tcp:%d", port), "-sTCP:LISTEN").Output()
	if err != nil {
		return nil
	}
	line := strings.TrimSpace(strings.Split(string(out), "\n")[0])
	pid, err := strconv.Atoi(line)
	if err != nil || pid <= 0 {
		return nil
	}
	return &pid
}

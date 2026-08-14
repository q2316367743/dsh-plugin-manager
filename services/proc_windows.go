//go:build windows

package services

import (
	"context"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const createNoWindow = 0x08000000 // CREATE_NO_WINDOW：控制台程序不创建窗口

// spawnProcAttr 返回子进程启动属性。Windows GUI 应用无控制台，spawn 控制台
// 程序（node / bun / cmd.exe 等）时不带 CREATE_NO_WINDOW 会闪现黑窗口
// （web 服务被关掉黑窗即退出），所有 spawn 必须走此属性。
// Windows 无进程组概念，detached 子进程天然独立运行，无需额外标志。
func spawnProcAttr(_ bool) *syscall.SysProcAttr {
	return &syscall.SysProcAttr{CreationFlags: createNoWindow}
}

// 标准库 syscall 未导出的两个常量（同 wails updater 的处理：本地定义避免依赖 x/sys/windows）。
const (
	processQueryLimitedInformation = 0x1000 // PROCESS_QUERY_LIMITED_INFORMATION
	stillActive                    = 259    // STILL_ACTIVE
)

// terminateProc 以指定访问权限打开进程并终止。
func terminateProc(pid int) bool {
	h, err := syscall.OpenProcess(syscall.PROCESS_TERMINATE, false, uint32(pid))
	if err != nil {
		return false
	}
	defer syscall.CloseHandle(h)
	// TerminateProcess 的退出码参数无实际意义，传 1 即可。
	err = syscall.TerminateProcess(h, 1)
	return err == nil
}

// collectDescendants 用 CreateToolhelp32Snapshot 采集全进程表，BFS 收集 pid 的全部后代。
// 标准库 syscall 已导出快照与遍历 API，无需引入 x/sys/windows。
func collectDescendants(pid int) []int {
	snap, err := syscall.CreateToolhelp32Snapshot(syscall.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return nil
	}
	defer syscall.CloseHandle(snap)

	parent := make(map[int]int)
	var entry syscall.ProcessEntry32
	entry.Size = uint32(unsafe.Sizeof(entry))
	if err := syscall.Process32First(snap, &entry); err != nil {
		return nil
	}
	for {
		parent[int(entry.ProcessID)] = int(entry.ParentProcessID)
		if err := syscall.Process32Next(snap, &entry); err != nil {
			break
		}
	}

	desc := make([]int, 0)
	seen := map[int]bool{pid: true}
	queue := []int{pid}
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		for child, ppid := range parent {
			if ppid == cur && !seen[child] {
				seen[child] = true
				desc = append(desc, child)
				queue = append(queue, child)
			}
		}
	}
	return desc
}

// killTree 终止 pid 及其全部后代（先子后父）。Windows 的 TerminateProcess 只作用于
// 单个进程：web 服务常经 cmd.exe 运行 .cmd 脚手架再拉起 node/bun，只杀 cmd.exe 会
// 让真正的服务进程残留并继续占端口，必须整体终止进程树。
func killTree(pid int) bool {
	for _, child := range collectDescendants(pid) {
		terminateProc(child)
	}
	return terminateProc(pid)
}

// requestTerminate 温和终止：Windows 无 POSIX 信号，按进程树 TerminateProcess。
func requestTerminate(pid int) bool {
	return killTree(pid)
}

// forceKill 兜底强杀：与 requestTerminate 相同（Windows 只有终止一种方式）。
func forceKill(pid int) {
	_ = killTree(pid)
}

// findPidByPortWindows 查询监听指定端口的 PID。走 PowerShell 的 CIM 查询
// （Get-NetTCPConnection，属性名为英文，不受系统语言本地化影响），规避
// netstat -ano 状态词在非英文系统被本地化（如中文的“监听”）导致匹配失败。
func findPidByPortWindows(port int) *int {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	script := fmt.Sprintf(
		"Get-NetTCPConnection -LocalPort %d -State Listen | Select-Object -ExpandProperty OwningProcess",
		port,
	)
	out, err := exec.CommandContext(ctx, "powershell", "-NoProfile", "-NonInteractive", "-Command", script).Output()
	if err != nil {
		return nil
	}
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		pid, err := strconv.Atoi(line)
		if err != nil || pid <= 0 {
			continue
		}
		return &pid
	}
	return nil
}

// procAlive 报告 pid 进程是否存活（OpenProcess + GetExitCodeProcess，
// 避免 os.Process.Signal 在 Windows 上总是报错的问题）。
func procAlive(pid int) bool {
	h, err := syscall.OpenProcess(processQueryLimitedInformation, false, uint32(pid))
	if err != nil {
		return false
	}
	defer syscall.CloseHandle(h)
	var code uint32
	if err := syscall.GetExitCodeProcess(h, &code); err != nil {
		return false
	}
	return code == stillActive
}

//go:build windows

package services

import "syscall"

// Windows 无进程组概念，detached 子进程天然独立运行，无需额外属性。
func detachedSysProcAttr() *syscall.SysProcAttr {
	return nil
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

// requestTerminate 温和终止：Windows 无 POSIX 信号，直接 TerminateProcess。
func requestTerminate(pid int) bool {
	return terminateProc(pid)
}

// forceKill 兜底强杀：与 requestTerminate 相同（Windows 只有终止一种方式）。
func forceKill(pid int) {
	_ = terminateProc(pid)
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

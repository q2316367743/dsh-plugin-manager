//go:build !windows

package services

import "syscall"

// spawnProcAttr 返回子进程启动属性：detached 时脱离当前进程组
// （父进程退出后继续运行），非 detached 无特殊属性。
func spawnProcAttr(detached bool) *syscall.SysProcAttr {
	if !detached {
		return nil
	}
	return &syscall.SysProcAttr{Setpgid: true}
}

// requestTerminate 温和终止：发送 SIGTERM。
func requestTerminate(pid int) bool {
	return syscall.Kill(pid, syscall.SIGTERM) == nil
}

// forceKill 兜底强杀：SIGKILL。
func forceKill(pid int) {
	_ = syscall.Kill(pid, syscall.SIGKILL)
}

// procAlive 报告 pid 进程是否存活（signal 0 探测）。
func procAlive(pid int) bool {
	err := syscall.Kill(pid, 0)
	return err == nil || err == syscall.EPERM
}

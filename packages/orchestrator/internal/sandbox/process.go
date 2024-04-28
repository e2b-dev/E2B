package sandbox

import (
	"fmt"
	"os"
	"syscall"
	"time"
)

const processCheckInterval = 1 * time.Second

func recoverProcess(pid int) (*os.Process, error) {
	// This is NOOP on Linux, it only returns the process struct with PID
	p, err := os.FindProcess(pid)
	if err != nil {
		return nil, fmt.Errorf("failed to find process %d: %w", pid, err)
	}

	// Checks process existence
	err = p.Signal(syscall.Signal(0))
	if err != nil {
		return nil, fmt.Errorf("failed to signal process %d: %w", pid, err)
	}

	_, err = checkIsRunning(p)
	if err != nil {
		return nil, fmt.Errorf("process %d is not running: %w", pid, err)
	}

	return p, nil
}

func checkIsRunning(p *os.Process) (bool, error) {
	var ws syscall.WaitStatus
	pid, err := syscall.Wait4(p.Pid, &ws, syscall.WNOHANG, nil)
	if err != nil {
		return false, fmt.Errorf("failed to wait for process %d: %w", p.Pid, err)
	}

	if pid == 0 {
		// Process has not exited
		return true, nil
	}

	return false, nil // Process has exited
}

package sandbox

import (
	"fmt"
	"os"
	"syscall"
	"time"
)

const processCheckInterval = 1 * time.Second

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

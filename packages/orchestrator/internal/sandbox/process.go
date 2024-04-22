package sandbox

import (
	"fmt"
	"os"
	"syscall"
	"time"
)

const processCheckInterval = 1 * time.Second

func recoverProcess(pid int) (*os.Process, error) {
	p, err := os.FindProcess(pid)
	if err != nil {
		return nil, fmt.Errorf("failed to find process %d: %w", pid, err)
	}

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
	err := p.Signal(syscall.Signal(0))
	if err != nil {
		return false, fmt.Errorf("failed to signal process %d: %w", p.Pid, err)
	}

	return true, nil
}

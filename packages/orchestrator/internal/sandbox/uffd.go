package sandbox

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"go.opentelemetry.io/otel/trace"
)

const SigkillWait = 5 * time.Second

var uffdCloseLock sync.Mutex

type UFFD struct {
	cmd            *exec.Cmd
	uffdSocketPath *string
	process        *os.Process

	pid int

	isBeingStopped bool
	mu             sync.Mutex
}

func (u *UFFD) Start() error {
	err := u.cmd.Start()
	if err != nil {
		return fmt.Errorf("failed to start uffd: %w", err)
	}

	u.pid = u.cmd.Process.Pid
	u.process = u.cmd.Process

	return nil
}

func (u *UFFD) Recover(pid int) error {
	p, err := recoverProcess(pid)
	if err != nil {
		return fmt.Errorf("failed to recover process %d: %w", pid, err)
	}

	u.pid = pid
	u.process = p

	return nil
}

func (u *UFFD) Stop(ctx context.Context, tracer trace.Tracer) {
	u.mu.Lock()
	if u.isBeingStopped {
		u.mu.Unlock()
		return
	}
	u.isBeingStopped = true
	u.mu.Unlock()

	uffdCloseLock.Lock()
	err := u.process.Signal(syscall.SIGTERM)
	if err != nil {
		fmt.Errorf("failed to send SIGINT to uffd: %w", err)
	}
	uffdCloseLock.Unlock()

	time.Sleep(SigkillWait)

	uffdCloseLock.Lock()
	err = u.process.Kill()
	if err != nil {
		fmt.Errorf("failed to send SIGINT to uffd: %w", err)
	}
	uffdCloseLock.Unlock()

	return
}

func NewUFFD(
	fsEnv *SandboxFiles,
) *UFFD {
	memfilePath := filepath.Join(fsEnv.EnvPath, MemfileName)
	cmd := exec.Command(fsEnv.UFFDBinaryPath, *fsEnv.UFFDSocketPath, memfilePath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	return &UFFD{
		cmd:            cmd,
		uffdSocketPath: fsEnv.UFFDSocketPath,
	}
}

func (u *UFFD) Wait() error {
	if u.cmd != nil {
		return u.cmd.Wait()
	}

	if u.process == nil {
		return fmt.Errorf("process is nil")
	}

	// When we recover process and the current process is not parent of that process .Wait will usually not work and throw an error.
	for {
		time.Sleep(processCheckInterval)

		isRunning, err := checkIsRunning(u.process)
		if !isRunning {
			return err
		}
	}
}

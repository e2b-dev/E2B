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
)

var uffdCloseLock sync.Mutex

type UFFD struct {
	cmd            *exec.Cmd
	uffdSocketPath *string
	pid            int
}

func (u *UFFD) Start() error {
	err := u.cmd.Start()
	if err != nil {
		return fmt.Errorf("failed to start uffd: %w", err)
	}

	u.pid = u.cmd.Process.Pid

	return nil
}

func (u *UFFD) Stop() error {
	uffdCloseLock.Lock()
	err := u.cmd.Process.Signal(syscall.SIGTERM)
	if err != nil {
		uffdCloseLock.Unlock()
		return fmt.Errorf("failed to send SIGINT to uffd: %w", err)
	}
	uffdCloseLock.Unlock()

	time.Sleep(5 * time.Second)

	uffdCloseLock.Lock()
	err = u.cmd.Process.Kill()
	if err != nil {
		uffdCloseLock.Unlock()
		return fmt.Errorf("failed to send SIGINT to uffd: %w", err)
	}
	uffdCloseLock.Unlock()

	return nil
}

func NewUFFD(
	ctx context.Context,
	fsEnv *InstanceFiles,
) (*UFFD, error) {
	memfilePath := filepath.Join(fsEnv.EnvPath, MemfileName)
	cmd := exec.CommandContext(vmmCtx, fsEnv.UFFDBinaryPath, *fsEnv.UFFDSocketPath, memfilePath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	return &UFFD{
		cmd:            cmd,
		uffdSocketPath: fsEnv.UFFDSocketPath,
	}, nil
}

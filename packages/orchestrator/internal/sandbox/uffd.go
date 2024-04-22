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

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"go.opentelemetry.io/otel/trace"
)

const (
	SigkillWait      = 5 * time.Second
	SigkillWaitCheck = 100 * time.Millisecond
)

var uffdCloseLock sync.Mutex

type uffd struct {
	cmd            *exec.Cmd
	uffdSocketPath *string
	process        *os.Process

	pid int

	isBeingStopped bool
	mu             sync.Mutex
}

func (u *uffd) start() error {
	err := u.cmd.Start()
	if err != nil {
		return fmt.Errorf("failed to start uffd: %w", err)
	}

	u.pid = u.cmd.Process.Pid
	u.process = u.cmd.Process

	return nil
}

func (u *uffd) recover(pid int) error {
	p, err := recoverProcess(pid)
	if err != nil {
		return fmt.Errorf("failed to recover process %d: %w", pid, err)
	}

	u.pid = pid
	u.process = p

	return nil
}

func (u *uffd) stop(ctx context.Context, tracer trace.Tracer) {
	childCtx, childSpan := tracer.Start(ctx, "stop-uffd", trace.WithAttributes())
	defer childSpan.End()

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
		errMsg := fmt.Errorf("failed to send SIGINT to uffd: %w", err)
		telemetry.ReportError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "uffd SIGTERM sent")
	}
	uffdCloseLock.Unlock()

	time.Sleep(SigkillWait)

killWait:
	for {
		select {
		case <-time.After(SigkillWait):
			break killWait
		case <-ctx.Done():
			break killWait
		default:
			isRunning, _ := checkIsRunning(u.process)

			if !isRunning {
				return
			}

			time.Sleep(SigkillWaitCheck)
		}
	}

	uffdCloseLock.Lock()
	err = u.process.Kill()
	if err != nil {
		errMsg := fmt.Errorf("failed to send SIGINT to uffd: %w", err)
		telemetry.ReportError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "uffd SIGKILL sent")
	}
	uffdCloseLock.Unlock()
}

func newUFFD(
	fsEnv *SandboxFiles,
) *uffd {
	memfilePath := filepath.Join(fsEnv.EnvPath, MemfileName)
	cmd := exec.Command(fsEnv.UFFDBinaryPath, *fsEnv.UFFDSocketPath, memfilePath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	return &uffd{
		cmd:            cmd,
		uffdSocketPath: fsEnv.UFFDSocketPath,
	}
}

func (u *uffd) wait() error {
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

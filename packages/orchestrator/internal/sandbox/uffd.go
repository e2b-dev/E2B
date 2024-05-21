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

type uffd struct {
	cmd            *exec.Cmd
	uffdSocketPath *string
	process        *os.Process

	pid int

	mu sync.Mutex
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

func (u *uffd) stop(ctx context.Context, tracer trace.Tracer) {
	childCtx, childSpan := tracer.Start(ctx, "stop-uffd", trace.WithAttributes())
	defer childSpan.End()

	err := u.process.Signal(syscall.SIGTERM)
	if err != nil {
		errMsg := fmt.Errorf("failed to send SIGTERM to uffd: %w", err)
		telemetry.ReportError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "uffd SIGTERM sent")
	}

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
				break killWait
			}

			time.Sleep(SigkillWaitCheck)
		}
	}

	err = u.process.Kill()
	if err != nil {
		errMsg := fmt.Errorf("failed to send SIGKILL (after SIGTERM) to uffd: %w", err)
		telemetry.ReportError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "uffd SIGKILL sent")
	}
}

func newUFFD(
	fsEnv *SandboxFiles,
) *uffd {
	memfilePath := filepath.Join(fsEnv.EnvPath, MemfileName)
	cmd := exec.Command(fsEnv.UFFDBinaryPath, *fsEnv.UFFDSocketPath, memfilePath)

	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setsid: true, // Create a new session
		Credential: &syscall.Credential{
			Uid: 1000, // UID for user "ubuntu"
			Gid: 1000, // GID for user "ubuntu"
		},
	}

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	return &uffd{
		cmd:            cmd,
		uffdSocketPath: fsEnv.UFFDSocketPath,
	}
}

func (u *uffd) wait() error {
	return u.cmd.Wait()
}

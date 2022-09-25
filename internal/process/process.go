package process

import (
	"io"
	"os"
	"os/exec"
	"sync/atomic"
	"syscall"

	"go.uber.org/zap"
)

type ID = string

type Process struct {
	ID ID

	exited *atomic.Bool
	cmd    *exec.Cmd
	Stdin  *io.WriteCloser

	logger *zap.SugaredLogger
}

func New(id ID, cmdToExecute string, envVars *map[string]string, rootdir string, logger *zap.SugaredLogger) (*Process, error) {
	cmd := exec.Command("sh", "-c", "-l", cmdToExecute)
	cmd.Dir = rootdir

	formattedVars := os.Environ()

	for key, value := range *envVars {
		formattedVars = append(formattedVars, key+"="+value)
	}

	cmd.Env = formattedVars

	return &Process{
		ID:     id,
		cmd:    cmd,
		exited: &atomic.Bool{},
		logger: logger,
	}, nil
}

func (p *Process) Kill() {
	if err := p.cmd.Process.Signal(syscall.SIGTERM); err != nil {
		p.logger.Warnw("Failed to kill process with signal",
			"processID", p.ID,
			"cmd", p.cmd,
			"pid", p.cmd.Process.Pid,
			"error", err,
			"hasExited", p.HasExited(),
		)
	}
	if _, err := p.cmd.Process.Wait(); err != nil {
		p.logger.Warnw("Failed to wait for process to exit",
			"processID", p.ID,
			"cmd", p.cmd,
			"pid", p.cmd.Process.Pid,
			"error", err,
			"hasExited", p.HasExited(),
		)
	}
	p.SetHasExited(true)
}

func (p *Process) SetHasExited(value bool) {
	p.exited.Store(value)
}

func (p *Process) HasExited() bool {
	return p.exited.Load()
}

func (p *Process) WriteStdin(data string) error {
	_, err := io.WriteString(*p.Stdin, data)
	return err
}

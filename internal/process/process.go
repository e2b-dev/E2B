package process

import (
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"

	"go.uber.org/zap"
)

type ID = string

type Process struct {
	ID ID

	mu sync.RWMutex

	exited bool
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
		exited: false,
		logger: logger,
	}, nil
}

func (p *Process) Kill() {
	if err := p.cmd.Process.Signal(syscall.SIGTERM); err != nil {
		p.logger.Errorw("Failed to kill process with signal",
			"processID", p.ID,
			"cmd", p.cmd,
			"pid", p.cmd.Process.Pid,
			"error", err,
			"hasExited", p.HasExited(),
		)
	}
	if _, err := p.cmd.Process.Wait(); err != nil {
		p.logger.Errorw("Failed to wait for process to exit",
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
	p.mu.Lock()
	defer p.mu.Unlock()

	p.exited = value
}

func (p *Process) HasExited() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return p.exited
}

func (p *Process) WriteStdin(data string) error {
	_, err := io.WriteString(*p.Stdin, data)
	return err
}

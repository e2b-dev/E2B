package process

import (
	"io"
	"os"
	"os/exec"
	"syscall"

	"go.uber.org/zap"
)

type ID = string

type Process struct {
	logger *zap.SugaredLogger

	ID    ID
	cmd   *exec.Cmd
	Stdin *io.WriteCloser
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
		logger: logger,
	}, nil
}

func (p *Process) Kill() {
	if err := p.cmd.Process.Signal(syscall.SIGKILL); err != nil {
		p.logger.Warnw("Failed to kill process with signal",
			"processID", p.ID,
			"cmd", p.cmd,
			"pid", p.cmd.Process.Pid,
			"error", err,
		)
	} else {
		p.logger.Infow("Process killed",
			"processID", p.ID,
			"cmd", p.cmd,
			"pid", p.cmd.Process.Pid,
		)
	}
}

func (p *Process) WriteStdin(data string) error {
	_, err := io.WriteString(*p.Stdin, data)
	return err
}

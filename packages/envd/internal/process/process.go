package process

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"syscall"

	"github.com/e2b-dev/infra/packages/envd/internal/user"

	"go.uber.org/zap"
)

type ID = string

type Process struct {
	logger *zap.SugaredLogger
	cmd    *exec.Cmd
	Stdin  *io.WriteCloser
	ID     ID
}

func New(id ID, shell, cmdToExecute string, envVars *map[string]string, rootdir string, logger *zap.SugaredLogger, activeUser string) (*Process, error) {
	cmd := exec.Command(shell, "-l", "-c", cmdToExecute)

	usedUser := user.DefaultUser
	if activeUser != "" {
		usedUser = activeUser
	}

	uid, gid, homedir, username, err := user.GetUser(usedUser)
	if err != nil {
		return nil, fmt.Errorf("error getting user '%s': %w", usedUser, err)
	}

	cmd.SysProcAttr = &syscall.SysProcAttr{}
	cmd.SysProcAttr.Credential = &syscall.Credential{Uid: uint32(uid), Gid: uint32(gid), Groups: []uint32{uint32(gid)}, NoSetGroups: true}

	if rootdir == "" {
		cmd.Dir = homedir
	} else {
		cmd.Dir = rootdir
	}

	// We inherit the env vars from the root process, but we should handle this differently in the future.
	formattedVars := os.Environ()

	formattedVars = append(formattedVars, "HOME="+homedir)
	formattedVars = append(formattedVars, "USER="+username)
	formattedVars = append(formattedVars, "LOGNAME="+username)

	// Only the last values of the env vars are used - this allows for overwriting defaults
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
	if p.cmd.Process == nil {
		p.logger.Warnw("Process is nil, cannot kill",
			"processID", p.ID,
			"cmd", p.cmd,
		)

		return
	}

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
	if err != nil {
		return fmt.Errorf("error writing to stdin of process '%s': %w", p.ID, err)
	}

	return nil
}

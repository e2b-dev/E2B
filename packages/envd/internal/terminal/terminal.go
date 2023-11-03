package terminal

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"

	"github.com/creack/pty"
	"go.uber.org/zap"

	"github.com/e2b-dev/infra/packages/envd/internal/user"
)

type ID = string

type Terminal struct {
	logger *zap.SugaredLogger
	cmd    *exec.Cmd
	tty    *os.File
	ID     ID
}

func New(id, shell string, rootdir *string, cols, rows uint16, envVars *map[string]string, cmdToExecute *string, logger *zap.SugaredLogger) (*Terminal, error) {
	var cmd *exec.Cmd

	if cmdToExecute != nil {
		cmd = exec.Command(shell, "-i", "-l", "-c", *cmdToExecute)
	} else {
		// The -l option (according to the man page) makes "bash act as if it had been invoked as a login shell".
		cmd = exec.Command(shell, "-i", "-l")
	}

	uid, gid, homedir, username, err := user.GetUser(user.DefaultUser)
	if err != nil {
		return nil, fmt.Errorf("error getting user '%s': %w", user.DefaultUser, err)
	}

	cmd.SysProcAttr = &syscall.SysProcAttr{}
	cmd.SysProcAttr.Credential = &syscall.Credential{Uid: uint32(uid), Gid: uint32(gid), Groups: []uint32{uint32(gid)}, NoSetGroups: true}

	if rootdir == nil {
		cmd.Dir = homedir
	} else {
		cmd.Dir = *rootdir
	}
	// We inherit the env vars from the root process, but we should handle this differently in the future.
	formattedVars := os.Environ()

	formattedVars = append(formattedVars, "HOME="+homedir)
	formattedVars = append(formattedVars, "USER="+username)
	formattedVars = append(formattedVars, "LOGNAME="+username)
	formattedVars = append(formattedVars, "TERM=xterm")

	// Only the last values of the env vars are used - this allows for overwriting defaults
	if envVars != nil {
		for key, value := range *envVars {
			formattedVars = append(formattedVars, key+"="+value)
		}
	}

	cmd.Env = formattedVars

	tty, err := pty.StartWithSize(cmd, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
	if err != nil {
		return nil, fmt.Errorf("error starting pty with command '%s' in dir '%s' with '%d' cols and '%d' rows: %w", cmd, cmd.Dir, cols, rows, err)
	}

	return &Terminal{
		logger: logger,
		ID:     id,
		cmd:    cmd,
		tty:    tty,
	}, nil
}

func (t *Terminal) Pid() int {
	return t.cmd.Process.Pid
}

func (t *Terminal) Destroy() {
	t.logger.Debugw("Destroying terminal",
		"terminalID", t.ID,
		"cmd", t.cmd,
		"pid", t.cmd.Process.Pid,
	)

	if err := t.tty.Close(); err != nil {
		t.logger.Warnw("Failed to close tty",
			"terminalID", t.ID,
			"tty", t.tty.Name(),
			"cmd", t.cmd,
			"pid", t.cmd.Process.Pid,
			"error", err,
		)
	} else {
		t.logger.Debugw("Closed terminal PTY",
			"terminalID", t.ID,
			"cmd", t.cmd,
			"pid", t.cmd.Process.Pid,
		)
	}
}

func (t *Terminal) Write(b []byte) error {
	_, err := t.tty.Write(b)
	if err != nil {
		return fmt.Errorf("error writing to terminal '%s': %w", t.ID, err)
	}

	return nil
}

func (t *Terminal) Resize(cols, rows uint16) error {
	return pty.Setsize(t.tty, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
}

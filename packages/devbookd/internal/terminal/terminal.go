package terminal

import (
	"fmt"
	"os"
	"os/exec"

	"go.uber.org/zap"

	"github.com/creack/pty"
)

type ID = string

type Terminal struct {
	logger *zap.SugaredLogger

	ID  ID
	cmd *exec.Cmd
	tty *os.File
}

func New(id, shell, rootdir string, cols, rows uint16, envVars *map[string]string, cmdToExecute *string, logger *zap.SugaredLogger) (*Terminal, error) {
	var cmd *exec.Cmd

	if cmdToExecute != nil {
		cmd = exec.Command("sh", "-c", "-l", *cmdToExecute)
	} else {
		// The -l option (according to the man page) makes "bash act as if it had been invoked as a login shell".
		cmd = exec.Command(shell, "-l")
	}

	formattedVars := os.Environ()

	if envVars != nil {
		for key, value := range *envVars {
			formattedVars = append(formattedVars, key+"="+value)
		}
	}

	cmd.Env = append(
		formattedVars,
		"TERM=xterm",
	)

	cmd.Dir = rootdir

	tty, err := pty.StartWithSize(cmd, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
	if err != nil {
		return nil, fmt.Errorf("error starting pty with command '%s': %+v", cmd, err)
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

func (t *Terminal) Read(b []byte) (int, error) {
	return t.tty.Read(b)
}

func (t *Terminal) Destroy() {
	t.logger.Infow("Destroying terminal",
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
		t.logger.Infow("Closed terminal PTY",
			"terminalID", t.ID,
			"cmd", t.cmd,
			"pid", t.cmd.Process.Pid,
		)
	}
}

func (t *Terminal) Write(b []byte) (int, error) {
	return t.tty.Write(b)
}

func (t *Terminal) Resize(cols, rows uint16) error {
	return pty.Setsize(t.tty, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
}

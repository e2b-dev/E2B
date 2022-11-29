package terminal

import (
	"fmt"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"
	"syscall"

	"github.com/devbookhq/devbook-api/packages/devbookd/internal/process"
	"go.uber.org/zap"

	"github.com/creack/pty"
)

type ID = string

type Terminal struct {
	logger *zap.SugaredLogger

	mu sync.RWMutex

	childProcesses []process.ChildProcess
	destroyed      *atomic.Bool

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
		logger:    logger,
		ID:        id,
		cmd:       cmd,
		tty:       tty,
		destroyed: &atomic.Bool{},
	}, nil
}

func (t *Terminal) Pid() int {
	return t.cmd.Process.Pid
}

func (t *Terminal) SetIsDestroyed(value bool) {
	t.destroyed.Store(value)
}

func (t *Terminal) IsDestroyed() bool {
	return t.destroyed.Load()
}

func (t *Terminal) GetCachedChildProcesses() []process.ChildProcess {
	t.mu.RLock()
	defer t.mu.RUnlock()

	list := make([]process.ChildProcess, len(t.childProcesses))
	copy(list, t.childProcesses)

	return list
}

func (t *Terminal) SetCachedChildProcesses(cps []process.ChildProcess) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.childProcesses = cps
}

func (t *Terminal) Read(b []byte) (int, error) {
	return t.tty.Read(b)
}

func (t *Terminal) Destroy() {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.IsDestroyed() {
		t.logger.Debugw("Terminal was already destroyed",
			"terminalID", t.ID,
			"cmd", t.cmd,
			"pid", t.cmd.Process.Pid,
		)
		return
	} else {
		t.SetIsDestroyed(true)
	}

	if err := t.cmd.Process.Signal(syscall.SIGKILL); err != nil {
		t.logger.Warnw("Failed to kill terminal process",
			"terminalID", t.ID,
			"cmd", t.cmd,
			"pid", t.cmd.Process.Pid,
			"error", err,
		)
	}
	if err := t.tty.Close(); err != nil {
		t.logger.Warnw("Failed to close tty",
			"terminalID", t.ID,
			"tty", t.tty.Name(),
			"cmd", t.cmd,
			"pid", t.cmd.Process.Pid,
			"error", err,
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

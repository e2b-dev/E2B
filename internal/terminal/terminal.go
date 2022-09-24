package terminal

import (
	"fmt"
	"os"
	"os/exec"
	"sync"

	"github.com/devbookhq/devbookd/internal/process"
	"go.uber.org/zap"

	"github.com/creack/pty"
)

type ID = string

type Terminal struct {
	logger *zap.SugaredLogger

	mu sync.RWMutex

	childProcesses []process.ChildProcess
	isDestroyed    bool

	ID  ID
	cmd *exec.Cmd
	tty *os.File
}

func (t *Terminal) Pid() int {
	return t.cmd.Process.Pid
}

func (t *Terminal) IsDestroyed() bool {
	t.mu.RLock()
	defer t.mu.RUnlock()

	return t.isDestroyed
}

func (t *Terminal) GetCachedChildProcesses() []process.ChildProcess {
	t.mu.RLock()
	defer t.mu.RUnlock()

	return t.childProcesses
}

func (t *Terminal) SetCachedChildProcesses(cps []process.ChildProcess) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.childProcesses = cps
}

func New(logger *zap.SugaredLogger, id, shell, root string, cols, rows uint16) (*Terminal, error) {
	// The -l option (according to the man page) makes "bash act as if it had been invoked as a login shell".
	cmd := exec.Command(shell, "-l")
	cmd.Env = append(
		os.Environ(),
		"TERM=xterm",
	)
	cmd.Dir = root

	tty, err := pty.StartWithSize(cmd, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
	if err != nil {
		return nil, fmt.Errorf("error starting pty with command '%s': %+v", cmd, err)
	}

	childProcesses := []process.ChildProcess{}

	return &Terminal{
		logger:         logger,
		ID:             id,
		cmd:            cmd,
		tty:            tty,
		isDestroyed:    false,
		childProcesses: childProcesses,
	}, nil
}

func (t *Terminal) Read(b []byte) (int, error) {
	return t.tty.Read(b)
}

func (t *Terminal) Destroy() {
	t.logger.Infow("Destroy terminal",
		"terminalID", t.ID,
	)
	if err := t.cmd.Process.Kill(); err != nil {
		t.logger.Errorw("Failed to kill terminal process",
			"terminalID", t.ID,
			"cmd", t.cmd,
			"pid", t.cmd.Process.Pid,
			"error", err,
		)
	}
	if _, err := t.cmd.Process.Wait(); err != nil {
		t.logger.Errorw("Failed to wait for terminal process to exit",
			"terminalID", t.ID,
			"cmd", t.cmd,
			"pid", t.cmd.Process.Pid,
			"error", err,
		)
	}
	if err := t.tty.Close(); err != nil {
		t.logger.Errorw("Failed to close tty",
			"terminalID", t.ID,
			"tty", t.tty.Name(),
			"cmd", t.cmd,
			"pid", t.cmd.Process.Pid,
			"error", err,
		)
	}

	t.mu.Lock()
	t.isDestroyed = true
	t.mu.Unlock()
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

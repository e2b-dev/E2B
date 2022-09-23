package terminal

import (
	"fmt"
	"os"
	"os/exec"
	"sync"

	"github.com/devbookhq/devbookd/internal/process"
	"go.uber.org/zap"

	"github.com/creack/pty"
	"github.com/rs/xid"
)

type TerminalID = string

type Terminal struct {
	logger *zap.SugaredLogger
	lock   sync.RWMutex

	childProcesses *[]process.ChildProcess
	isDestroyed    bool

	ID  TerminalID
	cmd *exec.Cmd
	tty *os.File
}

func (t *Terminal) Pid() int {
	return t.cmd.Process.Pid
}

func (t *Terminal) IsDestroyed() bool {
	t.lock.RLock()
	defer t.lock.RUnlock()

	return t.isDestroyed
}

func (t *Terminal) GetCachedChildProcesses() *[]process.ChildProcess {
	t.lock.RLock()
	defer t.lock.RUnlock()

	return t.childProcesses
}

func (t *Terminal) SetCachedChildProcesses(cps *[]process.ChildProcess) {
	t.lock.Lock()
	defer t.lock.Unlock()

	t.childProcesses = cps
}

func NewTerminal(logger *zap.SugaredLogger, id, shell, root string, cols, rows uint16) (*Terminal, error) {
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
		return nil, fmt.Errorf("failed to pty.Start() with command '%s': %s", cmd, err)
	}

	childProcesses := []process.ChildProcess{}

	if id == "" {
		id = xid.New().String()
	}

	return &Terminal{
		logger:         logger,
		ID:             id,
		cmd:            cmd,
		tty:            tty,
		isDestroyed:    false,
		childProcesses: &childProcesses,
	}, nil
}

func (t *Terminal) Read(b []byte) (int, error) {
	return t.tty.Read(b)
}

func (t *Terminal) Destroy() {
	t.logger.Infow("Destroying terminal", "id", t.ID)
	if err := t.cmd.Process.Kill(); err != nil {
		t.logger.Errorw("Failed kill terminal command",
			"id", t.ID,
			"cmd", t.cmd,
			"pid", t.cmd.Process.Pid,
			"error", err,
		)
	}
	if _, err := t.cmd.Process.Wait(); err != nil {
		t.logger.Errorw("Failed wait for terminal command to exit",
			"id", t.ID,
			"cmd", t.cmd,
			"pid", t.cmd.Process.Pid,
			"error", err,
		)
	}
	if err := t.tty.Close(); err != nil {
		t.logger.Errorw("Failed to close tty",
			"id", t.ID,
			"tty", t.tty.Name(),
			"cmd", t.cmd,
			"pid", t.cmd.Process.Pid,
			"error", err,
		)
	}

	t.lock.Lock()
	t.isDestroyed = true
	t.lock.Unlock()
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

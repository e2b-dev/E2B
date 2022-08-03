package terminal

import (
	"fmt"
	"os"
	"os/exec"
	"sync"

	"github.com/devbookhq/orchestration-services/fc-env/devbookd/pkg/process"

	"github.com/creack/pty"
	"github.com/rs/xid"
)

type TerminalID = string

type Terminal struct {
	lock sync.RWMutex

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

func NewTerminal(root string, cols, rows uint16) (*Terminal, error) {
	// The -l option (according to the man page) makes "bash act as if it had been invoked as a login shell".
	cmd := exec.Command("/bin/sh", "-l")
	cmd.Env = append(
		os.Environ(),
		"TERM=xterm",
		"PS1=\\w \\$ ",
	)
	cmd.Dir = root

	tty, err := pty.StartWithSize(cmd, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
	if err != nil {
		return nil, fmt.Errorf("Failed to pty.Start() with command '%s': %s", cmd, err)
	}

	childProcesses := []process.ChildProcess{}

	return &Terminal{
		ID:             xid.New().String(),
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
	t.cmd.Process.Kill()
	t.cmd.Process.Wait()
	t.tty.Close()

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

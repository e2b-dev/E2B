package terminal

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/creack/pty"
	"github.com/rs/xid"
)

type TerminalID = string

type Terminal struct {
	ID  TerminalID
	cmd *exec.Cmd
	tty *os.File
}

func NewTerminal(root string, cols, rows uint16) (*Terminal, error) {
	// The -l option (according to the man page) makes "bash act as if it had been invoked as a login shell".
	cmd := exec.Command("/bin/sh", "-l")
	cmd.Env = append(os.Environ(), "TERM=xterm")
	cmd.Dir = root

	tty, err := pty.StartWithSize(cmd, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
	if err != nil {
		return nil, fmt.Errorf("Failed to pty.Start() with command '%s': %s", cmd, err)
	}

	return &Terminal{
		ID:  xid.New().String(),
		cmd: cmd,
		tty: tty,
	}, nil
}

func (t *Terminal) Read(b []byte) (int, error) {
	return t.tty.Read(b)
}

func (t *Terminal) Destroy() {
	t.cmd.Process.Kill()
	t.cmd.Process.Wait()
	t.tty.Close()
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

package terminal

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/creack/pty"
	"github.com/devbookhq/orchestration-services/fc-env/devbookd/pkg/util"
	"go.uber.org/zap"
)

type TerminalID = string

type Terminal struct {
	ID  TerminalID
	cmd *exec.Cmd
	tty *os.File
}

func newTerminal() (*Terminal, error) {
	// TODO: -l may not work with the ash shell
	// TODO: -l TERM=xterm may not work with ash shell
	// The -l option (according to the man page) makes "bash act as if it had been invoked as a login shell".
	cmd := exec.Command("/bin/ash", "-l")
	cmd.Env = append(os.Environ(), "TERM=xterm")

	tty, err := pty.Start(cmd)
	if err != nil {
		return nil, fmt.Errorf("Failed to pty.Start() with command '%s': %s", cmd, err)
	}

	return &Terminal{
		ID:  util.RandString(6),
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

func (t *Terminal) Watch(handleData func(data string), logger *zap.SugaredLogger) {
	for {
		buf := make([]byte, 1024)
		read, err := t.Read(buf)

		if err != nil {
			logger.Error("Failed to read from terminal")
			return
		}

		handleData(string(buf[:read]))
	}
}

package process

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"syscall"

	"github.com/e2b-dev/infra/packages/envd/internal/services/permissions"
	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process/v1"

	"github.com/creack/pty"
)

type process struct {
	config *v1.ProcessConfig

	cmd *exec.Cmd
	tty *os.File

	stdin io.WriteCloser
}

func new(req *v1.StartProcessRequest) (*process, error) {
	cmd := exec.Command(req.GetProcess().GetCmd())

	u, uid, gid, err := permissions.GetUserByUsername(req.GetOwner().GetUsername())
	if err != nil {
		return nil, fmt.Errorf("error looking up user '%s': %w", req.GetOwner().GetUsername(), err)
	}

	cmd.SysProcAttr = &syscall.SysProcAttr{}
	cmd.SysProcAttr.Credential = &syscall.Credential{
		Uid:         uint32(uid),
		Gid:         uint32(gid),
		Groups:      []uint32{uint32(gid)},
		NoSetGroups: true,
	}

	cmd.Dir = req.GetProcess().GetWorkingDir()

	// We inherit the env vars from the root process, but we should handle this differently in the future.
	formattedVars := os.Environ()

	formattedVars = append(formattedVars, "HOME="+u.HomeDir)
	formattedVars = append(formattedVars, "USER="+u.Username)
	formattedVars = append(formattedVars, "LOGNAME="+u.Username)
	formattedVars = append(formattedVars, "TERM=xterm")

	// Only the last values of the env vars are used - this allows for overwriting defaults
	for key, value := range req.GetProcess().GetEnvVars() {
		formattedVars = append(formattedVars, key+"="+value)
	}

	cmd.Env = formattedVars

	var tty *os.File
	if req.GetPty() != nil {
		tty, err = pty.StartWithSize(cmd, &pty.Winsize{
			Cols: uint16(req.GetPty().GetSize().Cols),
			Rows: uint16(req.GetPty().GetSize().Rows),
		})
		if err != nil {
			return nil, fmt.Errorf("error starting pty with command '%s' in dir '%s' with '%d' cols and '%d' rows: %w", cmd, cmd.Dir, req.GetPty().GetSize().Cols, req.GetPty().GetSize().Rows, err)
		}
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("error creating stdin pipe for command '%s': %w", cmd, err)
	}

	return &process{
		config: req.GetProcess(),
		cmd:    cmd,
		tty:    tty,
		stdin:  stdin,
	}, nil
}

func (p *process) writeStdin(data []byte) error {
	_, err := p.stdin.Write(data)
	if err != nil {
		return fmt.Errorf("error writing to stdin of process '%s': %w", p.cmd.Process.Pid, err)
	}

	return nil
}

func (p *process) writeTty(data []byte) error {
	if p.tty == nil {
		return fmt.Errorf("tty not assigned to process")
	}

	_, err := p.tty.Write(data)
	if err != nil {
		return fmt.Errorf("error writing to tty of process '%s': %w", p.cmd.Process.Pid, err)
	}

	return nil
}

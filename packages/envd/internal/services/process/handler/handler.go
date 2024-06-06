package handler

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"

	"github.com/e2b-dev/infra/packages/envd/internal/services/permissions"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/process"

	"connectrpc.com/connect"
	"github.com/creack/pty"
)

const defaultOomScore = 100

type ProcessExit struct {
	Error  string
	Status string
	Exited bool
	Code   int32
}

type Handler struct {
	Config *rpc.ProcessConfig

	Tag *string
	cmd *exec.Cmd
	tty *os.File

	Stdout    *multiReader
	Stderr    *multiReader
	TtyOutput *multiReader

	stdin io.WriteCloser
	Exit  *multiResult[ProcessExit]

	stdinMu sync.Mutex
}

func New(req *rpc.StartRequest) (*Handler, error) {
	cmd := exec.Command(req.GetProcess().GetCmd(), req.GetProcess().GetArgs()...)

	u, err := permissions.GetUser(req.GetUser())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	uid, gid, err := permissions.GetUserIds(u)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	cmd.SysProcAttr = &syscall.SysProcAttr{}
	cmd.SysProcAttr.Credential = &syscall.Credential{
		Uid:         uid,
		Gid:         gid,
		Groups:      []uint32{gid},
		NoSetGroups: true,
	}

	resolvedPath, err := permissions.ExpandAndResolve(req.GetProcess().GetCwd(), u)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	cmd.Dir = resolvedPath

	var formattedVars []string

	formattedVars = append(formattedVars, "HOME="+u.HomeDir)
	formattedVars = append(formattedVars, "USER="+u.Username)
	formattedVars = append(formattedVars, "LOGNAME="+u.Username)

	// Only the last values of the env vars are used - this allows for overwriting defaults
	for key, value := range req.GetProcess().GetEnvs() {
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
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error starting pty with command '%s' in dir '%s' with '%d' cols and '%d' rows: %w", cmd, cmd.Dir, req.GetPty().GetSize().Cols, req.GetPty().GetSize().Rows, err))
		}
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error creating stdin pipe for command '%s': %w", cmd, err))
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error creating stdout pipe for command '%s': %w", cmd, err))
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error creating stderr pipe for command '%s': %w", cmd, err))
	}

	stdoutMultiplex := NewMultiReader(stdout)
	stderrMultiplex := NewMultiReader(stderr)

	var ttyMultiplex *multiReader
	if tty != nil {
		ttyMultiplex = NewMultiReader(tty)
	}

	return &Handler{
		Config:    req.GetProcess(),
		cmd:       cmd,
		tty:       tty,
		stdin:     stdin,
		Stdout:    stdoutMultiplex,
		Stderr:    stderrMultiplex,
		TtyOutput: ttyMultiplex,
		Tag:       req.Tag,
	}, nil
}

func (p *Handler) SendSignal(signal syscall.Signal) error {
	if p.cmd.Process == nil {
		return fmt.Errorf("process not started")
	}

	return p.cmd.Process.Signal(signal)
}

func (p *Handler) ResizeTty(size *pty.Winsize) error {
	if p.tty == nil {
		return fmt.Errorf("tty not assigned to process")
	}

	return pty.Setsize(p.tty, size)
}

func (p *Handler) WriteStdin(data []byte) error {
	p.stdinMu.Lock()
	defer p.stdinMu.Unlock()

	_, err := p.stdin.Write(data)
	if err != nil {
		return fmt.Errorf("error writing to stdin of process '%d': %w", p.cmd.Process.Pid, err)
	}

	return nil
}

func (p *Handler) WriteTty(data []byte) error {
	if p.tty == nil {
		return fmt.Errorf("tty not assigned to process")
	}

	_, err := p.tty.Write(data)
	if err != nil {
		return fmt.Errorf("error writing to tty of process '%d': %w", p.cmd.Process.Pid, err)
	}

	return nil
}

func (p *Handler) Start() (uint32, error) {
	err := p.cmd.Start()
	if err != nil {
		return 0, fmt.Errorf("error starting process '%s': %w", p.cmd, err)
	}

	adjustErr := adjustOomScore(p.cmd.Process.Pid, defaultOomScore)
	if adjustErr != nil {
		fmt.Fprintf(os.Stderr, "error adjusting oom score for process '%s': %s\n", p.cmd, adjustErr)
	}

	return uint32(p.cmd.Process.Pid), nil
}

func (p *Handler) Wait() {
	defer p.tty.Close()

	stdoutErr := p.Stdout.Wait()
	stderrErr := p.Stderr.Wait()

	waitErr := p.cmd.Wait()

	var err error
	if waitErr != nil {
		err = fmt.Errorf("error waiting for process '%s': %w", p.cmd, errors.Join(stdoutErr, stderrErr, waitErr))
	}

	p.Exit.Set(ProcessExit{
		Error:  err.Error(),
		Code:   int32(p.cmd.ProcessState.ExitCode()),
		Exited: p.cmd.ProcessState.Exited(),
		Status: p.cmd.ProcessState.String(),
	})
}

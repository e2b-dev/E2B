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
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"github.com/creack/pty"
)

const defaultOomScore = 100

type ProcessExit struct {
	Err        error
	Status     string
	Terminated bool
	Code       int32
}

type Handler struct {
	Config *rpc.ProcessConfig

	Tag *string
	cmd *exec.Cmd
	tty *os.File

	Stdout    *multiWriterCloser
	Stderr    *multiWriterCloser
	TtyOutput *multiWriterCloser

	stdin io.WriteCloser
	Exit  *multiResult[ProcessExit]

	stdinMu sync.Mutex
}

func New(req *rpc.StartRequest) (*Handler, error) {
	cmd := exec.Command(req.GetProcess().GetCmd(), req.GetProcess().GetArgs()...)

	u, err := permissions.GetUser(req.GetUser())
	if err != nil {
		return nil, fmt.Errorf("error looking up user '%s': %w", req.GetUser().GetUsername(), err)
	}

	uid, gid, err := permissions.GetUserIds(u)
	if err != nil {
		return nil, fmt.Errorf("error parsing uid and gid for user '%s': %w", req.GetUser().GetUsername(), err)
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
		return nil, fmt.Errorf("error resolving cwd for process '%s' and user '%s': %w", cmd, req.GetUser().GetUsername(), err)
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
			return nil, fmt.Errorf("error starting pty with command '%s' in dir '%s' with '%d' cols and '%d' rows: %w", cmd, cmd.Dir, req.GetPty().GetSize().Cols, req.GetPty().GetSize().Rows, err)
		}
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("error creating stdin pipe for command '%s': %w", cmd, err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("error creating stdout pipe for command '%s': %w", cmd, err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		errMsg := fmt.Errorf("error creating stderr pipe for command '%s': %w", cmd, err)

		closeErr := stdout.Close()
		if closeErr != nil {
			return nil, errors.Join(errMsg, fmt.Errorf("error closing stdout pipe for command '%s': %w", cmd, closeErr))
		}

		return nil, errMsg
	}

	stdoutMultiplex := NewMultiWriterCloser(stdout)
	stderrMultiplex := NewMultiWriterCloser(stderr)

	var ttyMultiplex *multiWriterCloser
	if tty != nil {
		ttyMultiplex = NewMultiWriterCloser(tty)
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
	if p.cmd.Process == nil {
		return 0, fmt.Errorf("process not started")
	}

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

	p.Stdout.Wait()
	p.Stderr.Wait()

	waitErr := p.cmd.Wait()

	var err error
	if waitErr != nil {
		err = fmt.Errorf("error waiting for process '%s': %w", p.cmd, waitErr)
	}

	p.Exit.Set(ProcessExit{
		Err:        err,
		Code:       int32(p.cmd.ProcessState.ExitCode()),
		Terminated: !p.cmd.ProcessState.Exited(),
		Status:     p.cmd.ProcessState.String(),
	})
}

package process

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"

	"github.com/e2b-dev/infra/packages/envd/internal/files"
	"github.com/e2b-dev/infra/packages/envd/internal/permissions"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"github.com/creack/pty"
)

const defaultOomScore = 100

type processExit struct {
	Err        error
	Terminated bool
	Code       int
	Status     string
}

type process struct {
	config *rpc.ProcessConfig

	cmd *exec.Cmd
	tty *os.File

	stdin   io.WriteCloser
	stdinMu sync.Mutex

	stdout    *MultiWriter
	stderr    *MultiWriter
	ttyOutput *MultiWriter
	wg        *sync.WaitGroup

	exit chan processExit

	tag *string
}

func newProcess(req *rpc.StartRequest, tag *string) (*process, error) {
	cmd := exec.Command(req.GetProcess().GetCmd(), req.GetProcess().GetArgs()...)

	u, uid, gid, err := permissions.GetUserByUsername(req.GetUser().GetUsername())
	if err != nil {
		return nil, fmt.Errorf("error looking up user '%s': %w", req.GetUser().GetUsername(), err)
	}

	cmd.SysProcAttr = &syscall.SysProcAttr{}
	cmd.SysProcAttr.Credential = &syscall.Credential{
		Uid:         uint32(uid),
		Gid:         uint32(gid),
		Groups:      []uint32{uint32(gid)},
		NoSetGroups: true,
	}

	resolvedPath, err := files.ExpandAndResolve(req.GetProcess().GetCwd(), u)
	if err != nil {
		return nil, fmt.Errorf("error resolving cwd for process '%s': %w", cmd, err)
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

	var wg sync.WaitGroup

	stdoutMultiplex := multiplexReader(&wg, stdout)
	stderrMultiplex := multiplexReader(&wg, stderr)

	var ttyMultiplex *MultiWriter
	if tty != nil {
		ttyMultiplex = multiplexReader(&wg, tty)
	}

	return &process{
		config:    req.GetProcess(),
		cmd:       cmd,
		tty:       tty,
		stdin:     stdin,
		exit:      make(chan processExit),
		stdout:    stdoutMultiplex,
		stderr:    stderrMultiplex,
		ttyOutput: ttyMultiplex,
		wg:        &wg,
		tag:       tag,
	}, nil
}

func (p *process) SendSignal(signal syscall.Signal) error {
	if p.cmd.Process == nil {
		return fmt.Errorf("process not started")
	}

	return p.cmd.Process.Signal(signal)
}

func (p *process) ResizeTty(size *pty.Winsize) error {
	if p.tty == nil {
		return fmt.Errorf("tty not assigned to process")
	}

	return pty.Setsize(p.tty, size)
}

func (p *process) WriteStdin(data []byte) error {
	p.stdinMu.Lock()
	defer p.stdinMu.Unlock()

	_, err := p.stdin.Write(data)
	if err != nil {
		return fmt.Errorf("error writing to stdin of process '%s': %w", p.cmd.Process.Pid, err)
	}

	return nil
}

func (p *process) WriteTty(data []byte) error {
	if p.tty == nil {
		return fmt.Errorf("tty not assigned to process")
	}

	_, err := p.tty.Write(data)
	if err != nil {
		return fmt.Errorf("error writing to tty of process '%s': %w", p.cmd.Process.Pid, err)
	}

	return nil
}

func (p *process) Start() (uint32, error) {
	if p.cmd.Process == nil {
		return 0, fmt.Errorf("process not started")
	}

	err := p.cmd.Start()
	if err != nil {
		return 0, fmt.Errorf("error starting process '%s': %w", p.cmd, err)
	}

	adjustErr := adjustOomScore(p.cmd.Process.Pid, defaultOomScore)
	if adjustErr != nil {
		fmt.Fprintln(os.Stderr, "error adjusting oom score for process '%s': %s", p.cmd, adjustErr)
	}

	return uint32(p.cmd.Process.Pid), nil
}

func (p *process) Wait() (*os.ProcessState, error) {
	p.wg.Wait()

	waitErr := p.cmd.Wait()

	var err error
	if waitErr != nil {
		err = fmt.Errorf("error waiting for process '%s': %w", p.cmd, waitErr)
	}

	p.exit <- processExit{
		Err:        err,
		Code:       p.cmd.ProcessState.ExitCode(),
		Terminated: p.cmd.ProcessState.Exited(),
		Status:     p.cmd.ProcessState.String(),
	}

	return p.cmd.ProcessState, nil
}

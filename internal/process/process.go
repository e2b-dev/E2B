package process

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"

	"go.uber.org/zap"
)

type ChildProcess struct {
	Cmd string `json:"cmd"`
	Pid int    `json:"pid"`
}

func GetChildProcesses(pid int, logger *zap.SugaredLogger) ([]ChildProcess, error) {
	cmd := exec.Command("pgrep", "-l", "-P", fmt.Sprint(pid))
	out, err := cmd.Output()

	children := []ChildProcess{}

	if err != nil {
		// pgrep has exit code 1 if no processes were found
		if cmd.ProcessState.ExitCode() == 1 {
			return children, nil
		} else {
			logger.Errorw("Failed listing child processes for process %d: %s, %+v", pid, err)
			return nil, fmt.Errorf("error listing child processes for process '%d': %+v", pid, err)
		}
	}

	lines := strings.Split(string(out), "\n")

	for _, line := range lines {
		parsed := strings.Split(line, " ")

		if len(parsed) != 2 {
			continue
		}

		cpid, err := strconv.Atoi(parsed[0])
		if err != nil {
			return nil, fmt.Errorf("error converting child process in %s: %+v", line, err)
		}

		ccmd := parsed[1]

		children = append(children, ChildProcess{
			Cmd: ccmd,
			Pid: cpid,
		})
	}

	sort.Slice(children, func(i, j int) bool {
		return children[i].Pid < children[j].Pid
	})

	return children, nil
}

func KillProcess(pid int) error {
	err := syscall.Kill(pid, syscall.SIGKILL)

	if err != nil {
		return fmt.Errorf("error killing process %d: %+v", pid, err)
	}

	return nil
}

type ID = string

type Process struct {
	ID ID

	mu sync.RWMutex

	hasExited bool
	Cmd       *exec.Cmd
	Stdin     *io.WriteCloser
}

func New(id ID, cmdToExecute string, envVars *map[string]string, rootdir string) (*Process, error) {
	cmd := exec.Command("sh", "-c", "-l", cmdToExecute)
	cmd.Dir = rootdir

	formattedVars := os.Environ()

	for key, value := range *envVars {
		formattedVars = append(formattedVars, key+"="+value)
	}

	cmd.Env = formattedVars

	return &Process{
		ID:        id,
		Cmd:       cmd,
		hasExited: false,
	}, nil
}

func (p *Process) Kill() error {
	return p.Cmd.Process.Kill()
}

func (p *Process) SetHasExited(value bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.hasExited = value
}

func (p *Process) HasExited() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return p.hasExited
}

func (p *Process) WriteStdin(data string) error {
	_, err := io.WriteString(*p.Stdin, data)
	return err
}

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
	out, _ := exec.Command("pgrep", "-l", "-P", fmt.Sprint(pid)).Output()

	children := []ChildProcess{}

	// if err != nil {
	// 	// logger.Warnf("failed listing child processes for process %d: %s, %+v", pid, string(out), err)
	// 	// return &children, nil
	// }

	lines := strings.Split(string(out), "\n")

	for _, line := range lines {
		parsed := strings.Split(line, " ")

		if len(parsed) != 2 {
			continue
		}

		cpid, err := strconv.Atoi(parsed[0])
		if err != nil {
			return nil, fmt.Errorf("failed converting child process in %s: %+v", line, err)
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
		return fmt.Errorf("failed to kill process %d: %+v", pid, err)
	}

	return nil
}

type ID = string

type Process struct {
	ID ID

	lock sync.RWMutex

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
	p.lock.Lock()
	defer p.lock.Unlock()
	p.hasExited = value
}

func (p *Process) HasExited() bool {
	p.lock.RLock()
	defer p.lock.RUnlock()

	return p.hasExited
}

func (p *Process) WriteStdin(data string) error {
	_, err := io.WriteString(*p.Stdin, data)
	return err
}

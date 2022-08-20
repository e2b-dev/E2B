package process

import (
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"syscall"

	"github.com/rs/xid"
	"go.uber.org/zap"
)

type ChildProcess struct {
	Cmd string `json:"cmd"`
	Pid int    `json:"pid"`
}

func GetChildProcesses(pid int, logger *zap.SugaredLogger) (*[]ChildProcess, error) {
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

	return &children, nil
}

func KillProcess(pid int) error {
	err := syscall.Kill(pid, syscall.SIGKILL)

	if err != nil {
		return fmt.Errorf("failed to kill process %d: %+v", pid, err)
	}

	return nil
}

type ProcessID = string

type Process struct {
	ID  ProcessID
	Cmd *exec.Cmd
}

func NewProcess(cmdToExecute string, envVars *map[string]string, rootdir string) (*Process, error) {
	cmd := exec.Command("sh", "-c", "-l", cmdToExecute)
	cmd.Dir = rootdir

	formattedVars := os.Environ()

	for key, value := range *envVars {
		formattedVars = append(formattedVars, key+"="+value)
	}

	cmd.Env = formattedVars

	return &Process{
		ID:  xid.New().String(),
		Cmd: cmd,
	}, nil
}

func (p *Process) Kill() error {
	return p.Cmd.Process.Kill()
}

func (p *Process) IsRunning() bool {
	if p.Cmd.ProcessState.Exited() || p.Cmd.ProcessState.Success() {
		return false
	}

	process, err := os.FindProcess(p.Cmd.Process.Pid)
	if err != nil {
		return false
	}

	if process.Signal(syscall.Signal(0)) != nil {
		return false
	}

	return true
}

func (p *Process) WriteStdin(data string) error {
	_, err := p.Cmd.Stdin.Read([]byte(data))
	return err
}

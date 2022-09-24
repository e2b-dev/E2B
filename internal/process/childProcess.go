package process

import (
	"fmt"
	"os/exec"
	"sort"
	"strconv"
	"strings"
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

func KillChildProcess(pid int) error {
	err := syscall.Kill(pid, syscall.SIGKILL)

	if err != nil {
		return fmt.Errorf("error killing process %d: %+v", pid, err)
	}

	return nil
}

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

func GetChildProcesses(pid int, logger *zap.SugaredLogger) (*[]ChildProcess, error) {
	out, err := exec.Command("pgrep", "-l", "-P", fmt.Sprint(pid)).Output()

	if err != nil {
		logger.Warnf("failed listing child processes for process %d: %s, %+v", pid, string(out), err)
	}

	lines := strings.Split(string(out), "\n")

	children := []ChildProcess{}

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
		return fmt.Errorf("Failed to kill process %d: %+v", pid, err)
	}

	return nil
}

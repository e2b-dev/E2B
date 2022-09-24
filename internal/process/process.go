package process

import (
	"io"
	"os"
	"os/exec"
	"sync"
)

type ID = string

type Process struct {
	ID ID

	mu sync.RWMutex

	exited bool
	Cmd    *exec.Cmd
	Stdin  *io.WriteCloser
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
		ID:     id,
		Cmd:    cmd,
		exited: false,
	}, nil
}

func (p *Process) Kill() error {
	return p.Cmd.Process.Kill()
}

func (p *Process) SetHasExited(value bool) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.exited = value
}

func (p *Process) HasExited() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return p.exited
}

func (p *Process) WriteStdin(data string) error {
	_, err := io.WriteString(*p.Stdin, data)
	return err
}

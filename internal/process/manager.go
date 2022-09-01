package process

import (
	"fmt"
	"sync"
)

type ProcessManager struct {
	lock    sync.RWMutex
	procMap map[ProcessID]*Process
}

func NewProcessManager() *ProcessManager {
	return &ProcessManager{
		procMap: make(map[ProcessID]*Process),
	}
}

func (p *ProcessManager) Remove(id ProcessID) {
	proc, ok := p.Get(id)

	if !ok {
		return
	}

	proc.Kill()

	p.lock.Lock()
	defer p.lock.Unlock()

	delete(p.procMap, id)
}

func (p *ProcessManager) Get(id ProcessID) (*Process, bool) {
	if id == "" {
		return nil, false
	}

	p.lock.RLock()
	defer p.lock.RUnlock()

	proc, ok := p.procMap[id]
	return proc, ok
}

func (p *ProcessManager) Add(id ProcessID, cmd string, envVars *map[string]string, rootdir string) (*Process, error) {
	proc, err := NewProcess(id, cmd, envVars, rootdir)
	if err != nil {
		return nil, fmt.Errorf("failed to start new process: %s", err)
	}

	p.lock.Lock()
	defer p.lock.Unlock()

	p.procMap[proc.ID] = proc
	return proc, nil
}

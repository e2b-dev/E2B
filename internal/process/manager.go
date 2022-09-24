package process

import (
	"fmt"
	"sync"
)

type Manager struct {
	lock    sync.RWMutex
	procMap map[ID]*Process
}

func NewManager() *Manager {
	return &Manager{
		procMap: make(map[ID]*Process),
	}
}

func (m *Manager) Remove(id ID) {
	proc, ok := m.Get(id)

	if !ok {
		return
	}

	proc.Kill()

	m.lock.Lock()
	defer m.lock.Unlock()

	delete(m.procMap, id)
}

func (m *Manager) Get(id ID) (*Process, bool) {
	if id == "" {
		return nil, false
	}

	m.lock.RLock()
	defer m.lock.RUnlock()

	proc, ok := m.procMap[id]
	return proc, ok
}

func (m *Manager) Add(id ID, cmd string, envVars *map[string]string, rootdir string) (*Process, error) {
	proc, err := New(id, cmd, envVars, rootdir)
	if err != nil {
		return nil, fmt.Errorf("failed to start new process: %s", err)
	}

	m.lock.Lock()
	defer m.lock.Unlock()

	m.procMap[proc.ID] = proc
	return proc, nil
}

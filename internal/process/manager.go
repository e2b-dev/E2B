package process

import (
	"fmt"
	"sync"

	"go.uber.org/zap"
)

type Manager struct {
	mu      sync.RWMutex
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

	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.procMap, id)
}

func (m *Manager) Get(id ID) (*Process, bool) {
	if id == "" {
		return nil, false
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	proc, ok := m.procMap[id]
	return proc, ok
}

func (m *Manager) Add(id ID, cmd string, envVars *map[string]string, rootdir string, logger *zap.SugaredLogger) (*Process, error) {
	proc, err := New(id, cmd, envVars, rootdir, logger)
	if err != nil {
		return nil, fmt.Errorf("error starting new process with id '%s': %+v", id, err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.procMap[proc.ID] = proc
	return proc, nil
}

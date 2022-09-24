package terminal

import (
	"fmt"
	"sync"

	"go.uber.org/zap"
)

type Manager struct {
	mu      sync.RWMutex
	termMap map[ID]*Terminal
}

func NewManager() *Manager {
	return &Manager{
		termMap: make(map[ID]*Terminal),
	}
}

func (m *Manager) Remove(id ID) {
	term, ok := m.Get(id)

	if !ok {
		return
	}

	term.Destroy()

	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.termMap, id)
}

func (m *Manager) Get(id ID) (*Terminal, bool) {
	if id == "" {
		return nil, false
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	term, ok := m.termMap[id]
	return term, ok
}

func (m *Manager) Add(
	logger *zap.SugaredLogger,
	id,
	shell,
	root string,
	cols,
	rows uint16,
) (*Terminal, error) {
	term, err := New(id, shell, root, cols, rows, logger)
	if err != nil {
		return nil, fmt.Errorf("error creating new terminal: %+v", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.termMap[term.ID] = term
	return term, nil
}

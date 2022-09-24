package terminal

import (
	"fmt"
	"sync"

	"go.uber.org/zap"
)

type Manager struct {
	lock    sync.RWMutex
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

	m.lock.Lock()
	defer m.lock.Unlock()

	delete(m.termMap, id)
}

func (m *Manager) Get(id ID) (*Terminal, bool) {
	if id == "" {
		return nil, false
	}

	m.lock.RLock()
	defer m.lock.RUnlock()

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
	term, err := New(logger, id, shell, root, cols, rows)
	if err != nil {
		return nil, fmt.Errorf("failed to create new terminal: %s", err)
	}

	m.lock.Lock()
	defer m.lock.Unlock()

	m.termMap[term.ID] = term
	return term, nil
}

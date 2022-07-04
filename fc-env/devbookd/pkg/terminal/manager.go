package terminal

import (
	"fmt"
	"sync"
)

type TerminalManager struct {
	lock sync.RWMutex
	tmap map[TerminalID]*Terminal
}

func NewTerminalManager() *TerminalManager {
	return &TerminalManager{
		tmap: make(map[TerminalID]*Terminal),
	}
}

func (t *TerminalManager) Remove(id TerminalID) {
	term, ok := t.Get(&id)

	if !ok {
		return
	}

	term.Destroy()

	t.lock.Lock()
	defer t.lock.Unlock()
	delete(t.tmap, id)
}

func (m *TerminalManager) Get(id *TerminalID) (*Terminal, bool) {
	if id == nil {
		return nil, false
	}

	m.lock.RLock()
	defer m.lock.RUnlock()
	term, ok := m.tmap[*id]
	return term, ok
}

func (m *TerminalManager) Add() (*Terminal, error) {
	term, err := newTerminal()
	if err != nil {
		return nil, fmt.Errorf("failed to create new terminal: %s", err)
	}

	m.lock.Lock()
	defer m.lock.Unlock()
	m.tmap[term.ID] = term
	return term, nil
}

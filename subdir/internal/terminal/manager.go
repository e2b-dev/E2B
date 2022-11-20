package terminal

import (
	"fmt"

	"github.com/devbookhq/devbookd/internal/smap"
	"go.uber.org/zap"
)

type Manager struct {
	terms  *smap.Map[ID, Terminal]
	logger *zap.SugaredLogger
}

func NewManager(logger *zap.SugaredLogger) *Manager {
	return &Manager{
		terms:  smap.New[ID, Terminal](),
		logger: logger,
	}
}

func (m *Manager) Remove(id ID) {
	term, ok := m.terms.Get(id)

	if !ok {
		return
	}

	term.Destroy()
	m.terms.Remove(id)
}

func (m *Manager) Get(id ID) (*Terminal, bool) {
	return m.terms.Get(id)
}

func (m *Manager) Add(
	id,
	shell,
	root string,
	cols,
	rows uint16,
) (*Terminal, error) {
	term, err := New(id, shell, root, cols, rows, m.logger)
	if err != nil {
		return nil, fmt.Errorf("error creating new terminal: %+v", err)
	}

	m.terms.Insert(term.ID, term)
	return term, nil
}

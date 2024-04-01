package terminal

import (
	"fmt"

	"go.uber.org/zap"

	"github.com/e2b-dev/infra/packages/shared/pkg/smap"
)

type Manager struct {
	terms  *smap.Map[*Terminal]
	logger *zap.SugaredLogger
}

func NewManager(logger *zap.SugaredLogger) *Manager {
	return &Manager{
		terms:  smap.New[*Terminal](),
		logger: logger,
	}
}

func (m *Manager) Remove(id ID) {
	term, ok := m.terms.Get(id)

	if !ok {
		return
	}

	m.terms.Remove(id)

	term.Destroy()
}

func (m *Manager) Get(id ID) (*Terminal, bool) {
	return m.terms.Get(id)
}

func (m *Manager) Add(
	id,
	shell string,
	rootdir *string,
	cols,
	rows uint16,
	envVars *map[string]string,
	cmd *string,
) (*Terminal, error) {
	term, err := New(id, shell, rootdir, cols, rows, envVars, cmd, m.logger)
	if err != nil {
		return nil, fmt.Errorf("error creating new terminal: %w", err)
	}

	m.terms.Insert(term.ID, term)

	return term, nil
}

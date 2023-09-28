package process

import (
	"fmt"

	"github.com/devbookhq/devbook-api/packages/devbookd/internal/smap"
	"go.uber.org/zap"
)

type Manager struct {
	procs  *smap.Map[*Process]
	logger *zap.SugaredLogger
}

func NewManager(logger *zap.SugaredLogger) *Manager {
	return &Manager{
		procs:  smap.New[*Process](),
		logger: logger,
	}
}

func (m *Manager) Remove(id ID) {
	proc, ok := m.procs.Get(id)

	if !ok {
		return
	}

	proc.Kill()
	m.procs.Remove(id)
}

func (m *Manager) Get(id ID) (*Process, bool) {
	return m.procs.Get(id)
}

func (m *Manager) Add(id ID, shell, cmd string, envVars *map[string]string, rootdir string) (*Process, error) {
	proc, err := New(id, shell, cmd, envVars, rootdir, m.logger)
	if err != nil {
		return nil, fmt.Errorf("error configuring new process with id '%s': %+v", id, err)
	}

	m.procs.Insert(proc.ID, proc)
	return proc, nil
}

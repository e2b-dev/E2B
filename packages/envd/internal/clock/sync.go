package clock

import (
	"os/exec"
	"sync"

	"go.uber.org/zap"
)

type ClockSync struct {
	logger *zap.SugaredLogger
	// The sync could probably be done better with waitgroup
	mu sync.RWMutex
}

func New(logger *zap.SugaredLogger) *ClockSync {
	return &ClockSync{
		logger: logger,
		mu:     sync.RWMutex{},
	}
}

func (c *ClockSync) Sync() {
	c.mu.Lock()
	go func() {
		defer c.mu.Unlock()

		err := exec.Command("chronyc", "-a", "makestep").Run()
		if err != nil {
			c.logger.Errorw("Failed to sync clock", "error", err)
		} else {
			c.logger.Debug("Clock synced")
		}
	}()
}

func (c *ClockSync) Wait() {
	defer c.mu.RUnlock()
	c.mu.RLock()
}

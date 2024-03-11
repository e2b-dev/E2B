package clock

import (
	"os/exec"
	"sync"

	"go.uber.org/zap"
)

type ClockSync struct {
	logger *zap.SugaredLogger
	mu     sync.Mutex
}

func New(logger *zap.SugaredLogger) *ClockSync {
	return &ClockSync{
		logger: logger,
		mu:     sync.Mutex{},
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
	c.mu.Lock()
	defer c.mu.Unlock()
}

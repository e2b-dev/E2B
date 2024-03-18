package clock

import (
	"os/exec"
	"sync"

	"go.uber.org/zap"
)

type ClockSync struct {
	logger *zap.SugaredLogger
	shell  string
	mu     sync.Mutex
}

func New(logger *zap.SugaredLogger, shell string) *ClockSync {
	return &ClockSync{
		logger: logger,
		mu:     sync.Mutex{},
		shell:  shell,
	}
}

func (c *ClockSync) Sync() {
	c.logger.Debug("Waiting for clock sync lock")
	c.mu.Lock()

	go func() {
		defer c.mu.Unlock()
		c.logger.Info("Syncing clock")

		err := exec.Command(c.shell, "-l", "-c", "sudo chronyc -a makestep").Run()
		if err != nil {
			c.logger.Errorw("Failed to sync clock:",
				"error", err,
			)
		} else {
			c.logger.Debug("Clock synced")
		}
	}()
}

func (c *ClockSync) Wait() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.logger.Debug("Clock sync lock passsed")
}

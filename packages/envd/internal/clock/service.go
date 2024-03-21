package clock

import (
	"os/exec"
	"sync"

	"go.uber.org/zap"
)

type Service struct {
	logger *zap.SugaredLogger
	mu     sync.RWMutex
}

func NewService(logger *zap.SugaredLogger) *Service {
	return &Service{
		logger: logger,
		mu:     sync.RWMutex{},
	}
}

func (s *Service) Sync() {
	s.logger.Debug("Syncing clock")
	s.mu.Lock()

	go func() {
		defer s.mu.Unlock()

		err := exec.Command("/usr/bin/bash", "-c", "/usr/bin/date -s @$(/usr/sbin/phc_ctl /dev/ptp0 get | cut -d' ' -f5)").Run()
		// err := exec.Command("/usr/bin/bash", "-c", "/usr/bin/date -s @$(/usr/sbin/phc_ctl /dev/ptp0 get | awk '{print $5}')").Run()
		// err := exec.Command("/usr/bin/chronyc", "-a", "makestep").Run()
		if err != nil {
			s.logger.Errorw("Failed to sync clock:",
				"error", err,
			)
		} else {
			s.logger.Debugw("Clock synced")
		}
	}()
}

func (s *Service) Wait() {
	s.logger.Debug("Waiting for clock sync lock")
	s.mu.RLock()
	s.mu.RUnlock()

	s.logger.Debug("Clock sync lock passsed")
}

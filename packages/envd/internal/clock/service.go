package clock

import (
	"os/exec"
	"sync"
	"time"

	"go.uber.org/zap"
)

type Service struct {
	logger *zap.SugaredLogger
	shell  string
	mu     sync.Mutex
}

func NewService(logger *zap.SugaredLogger, shell string) *Service {
	return &Service{
		logger: logger,
		mu:     sync.Mutex{},
		shell:  shell,
	}
}

func (s *Service) Sync() {
	s.mu.Lock()

	go func() {
		defer s.mu.Unlock()
		s.logger.Debug("Syncing clock")

		start := time.Now()

		// err := exec.Command("/usr/bin/chronyc", "-a", "makestep").Run()
		err := exec.Command("/usr/bin/bash", "-c", "/usr/bin/date -s @$(/usr/sbin/phc_ctl /dev/ptp0 get | awk '{print $5}')").Run()
		if err != nil {
			s.logger.Errorw("Failed to sync clock:",
				"error", err,
			)
		} else {

			end := time.Since(start)
			s.logger.Debugw("Clock synced", "duration", end)
		}
	}()
}

func (s *Service) Wait() {
	s.logger.Debug("Waiting for clock sync lock")
	s.mu.Lock()
	defer s.mu.Unlock()

	s.logger.Debug("Clock sync lock passsed")
}

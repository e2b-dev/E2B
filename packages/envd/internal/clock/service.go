package clock

import (
	"os/exec"
	"sync"

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

		err := exec.Command(s.shell, "-l", "-c", "sudo chronyc -a makestep").Run()
		if err != nil {
			s.logger.Errorw("Failed to sync clock:",
				"error", err,
			)
		} else {
			s.logger.Debug("Clock synced")
		}
	}()
}

func (s *Service) Wait() {
	s.logger.Debug("Waiting for clock sync lock")
	s.mu.Lock()
	defer s.mu.Unlock()

	s.logger.Debug("Clock sync lock passsed")
}

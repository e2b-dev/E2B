package terminal

import (
	"context"
	"fmt"
	"io"
	"reflect"
	"time"

	"github.com/devbookhq/devbookd/internal/env"
	"github.com/devbookhq/devbookd/internal/process"
	"github.com/devbookhq/devbookd/internal/subscriber"
	"github.com/ethereum/go-ethereum/rpc"
	"github.com/rs/xid"
	"go.uber.org/zap"
)

const (
	terminalChildProcessCheckInterval = 400 * time.Millisecond
)

type Service struct {
	logger *zap.SugaredLogger
	env    *env.Env

	terminals *Manager

	dataSubs           *subscriber.Manager
	childProcessesSubs *subscriber.Manager
}

func NewService(logger *zap.SugaredLogger, env *env.Env) *Service {
	return &Service{
		logger:             logger,
		env:                env,
		terminals:          NewManager(),
		dataSubs:           subscriber.NewManager(),
		childProcessesSubs: subscriber.NewManager(),
	}
}

// Subscription
func (s *Service) OnData(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Infow("Subscribe to terminal data",
		"terminalID", id,
	)

	sub, err := s.dataSubs.Add(ctx, id, s.logger)
	if err != nil {
		s.logger.Errorw("Failed to create a data subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	return sub.Subscription, nil
}

// Subscription
func (s *Service) OnChildProcessesChange(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Infow("Subscribe to terminal child processes",
		"terminalID", id,
	)

	sub, err := s.childProcessesSubs.Add(ctx, id, s.logger)
	if err != nil {
		s.logger.Errorw("Failed to create a terminal child processes subscription",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	term, ok := s.terminals.Get(id)

	if ok {
		if err := sub.Notify(term.GetCachedChildProcesses()); err != nil {
			s.logger.Errorw("Failed to send initial child processes",
				"subID", sub.Subscription.ID,
				"error", err,
			)
		}
	}

	return sub.Subscription, nil
}

func (s *Service) Start(id ID, cols, rows uint16) (ID, error) {
	s.logger.Infow("Start terminal",
		"terminalID", id,
	)

	term, ok := s.terminals.Get(id)
	if !ok {
		// Terminal doesn't exist, we will create a new one.
		s.logger.Infow("Terminal with ID doesn't exist yet. Creating a new terminal",
			"requestedTerminalID", id,
		)

		id := id
		if id == "" {
			id = xid.New().String()
		}

		newTerm, err := s.terminals.Add(
			s.logger,
			id,
			s.env.Shell(),
			s.env.Workdir(),
			cols,
			rows,
		)
		if err != nil {
			errMsg := fmt.Sprintf("Failed to start new terminal: %v", err)
			s.logger.Info(errMsg)
			return "", fmt.Errorf(errMsg)
		}

		s.logger.Infow("New terminal created",
			"terminalID", newTerm.ID,
		)

		go func() {
			defer s.terminals.Remove(newTerm.ID)

			for {
				if newTerm.IsDestroyed() {
					return
				}

				buf := make([]byte, 1024)
				read, err := newTerm.Read(buf)

				if err != nil {
					if err == io.EOF {
						return
					} else {
						s.logger.Infow("Error reading from terminal",
							"terminalID", newTerm.ID,
							"error", err,
						)
						return
					}
				}

				if read > 0 {
					data := string(buf[:read])

					err = s.dataSubs.Notify(newTerm.ID, data)
					if err != nil {
						s.logger.Errorw("Failed to send data notification",
							"error", err,
						)
					}
				}
			}
		}()

		go func() {
			ticker := time.NewTicker(terminalChildProcessCheckInterval)
			defer ticker.Stop()

			pid := newTerm.Pid()

			for range ticker.C {
				if newTerm.IsDestroyed() {
					return
				}

				cps, err := process.GetChildProcesses(pid, s.logger)
				if err != nil {
					s.logger.Errorw("failed to get child processes for terminal",
						"terminalID", newTerm.ID,
						"pid", pid,
						"error", err,
					)
					return
				}

				changed := !reflect.DeepEqual(cps, newTerm.GetCachedChildProcesses())
				if !changed {
					continue
				}

				newTerm.SetCachedChildProcesses(cps)

				err = s.childProcessesSubs.Notify(newTerm.ID, cps)
				if err != nil {
					s.logger.Errorw("Failed to send child processes notification",
						"error", err,
					)
				}
			}
		}()

		s.logger.Infow("Started terminal output data watcher", "terminalID", newTerm.ID)
		return newTerm.ID, nil
	}

	s.logger.Infow("Terminal with this ID already exists", "terminalID", id)
	return term.ID, nil
}

func (s *Service) Data(id ID, data string) error {
	term, ok := s.terminals.Get(id)

	if !ok {
		errMsg := fmt.Sprintf("cannot find terminal with ID %s", id)
		s.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	if _, err := term.Write([]byte(data)); err != nil {
		errMsg := fmt.Sprintf("cannot write data %s to terminal with ID %s: %+v", data, id, err)
		s.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	return nil
}

func (s *Service) Resize(id ID, cols, rows uint16) error {
	term, ok := s.terminals.Get(id)

	if !ok {
		errMsg := fmt.Sprintf("cannot find terminal with ID %s", id)
		s.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	if err := term.Resize(cols, rows); err != nil {
		errMsg := fmt.Sprintf("cannot resize terminal with ID %s: %+v", id, err)
		s.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	return nil
}

func (s *Service) Destroy(id ID) {
	s.logger.Infow("Remove subscriber for terminal",
		"terminalID", id,
	)

	s.terminals.Remove(id)

	s.logger.Debugw("Sub count",
		"terminalID", id,
		"dataSubCountTotal", len(s.dataSubs.List()),
		"childProcSubsCountTotal", len(s.childProcessesSubs.List()),
	)
}

func (s *Service) KillProcess(pid int) error {
	if err := process.KillProcess(pid); err != nil {
		errMsg := fmt.Sprintf("cannot kill process %d: %v", pid, err)
		s.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}
	return nil
}

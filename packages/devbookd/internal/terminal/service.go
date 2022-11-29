package terminal

import (
	"context"
	"fmt"
	"io"
	"reflect"
	"time"

	"github.com/devbookhq/devbook-api/packages/devbookd/internal/env"
	"github.com/devbookhq/devbook-api/packages/devbookd/internal/process"
	"github.com/devbookhq/devbook-api/packages/devbookd/internal/subscriber"
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
	exitSubs           *subscriber.Manager
}

func NewService(logger *zap.SugaredLogger, env *env.Env) *Service {
	return &Service{
		logger: logger,

		env:       env,
		terminals: NewManager(logger),

		dataSubs:           subscriber.NewManager("terminal/dataSubs", logger.Named("subscriber.terminal.dataSubs")),
		childProcessesSubs: subscriber.NewManager("terminal/childProcessesSubs", logger.Named("subscriber.terminal.childProcessesSubs")),
		exitSubs:           subscriber.NewManager("terminal/exitSubs", logger.Named("subscriber.terminal.exitSubs")),
	}
}

func (s *Service) hasSubscibers(id ID) bool {
	return s.childProcessesSubs.Has(id) ||
		s.dataSubs.Has(id)
}

func (s *Service) Start(id ID, cols, rows uint16, envVars *map[string]string, cmd, rootdir *string) (ID, error) {
	s.logger.Infow("Start terminal",
		"terminalID", id,
	)

	term, ok := s.terminals.Get(id)

	// Terminal doesn't exist, we will create a new one.
	if !ok {
		s.logger.Infow("Terminal with ID doesn't exist yet. Creating a new terminal",
			"requestedTerminalID", id,
		)

		id := id
		if id == "" {
			id = xid.New().String()
		}

		var validRootdir string
		if rootdir != nil {
			validRootdir = *rootdir
		} else {
			validRootdir = s.env.Workdir()
		}

		newTerm, err := s.terminals.Add(
			id,
			s.env.Shell(),
			validRootdir,
			cols,
			rows,
			envVars,
			cmd,
		)
		if err != nil {
			notifyErr := s.exitSubs.Notify(id, struct{}{})
			if notifyErr != nil {
				s.logger.Errorw("Failed to send exit notification",
					"terminalID", id,
					"error", notifyErr,
				)
			}

			s.logger.Errorw("Failed to start new terminal",
				"terminalID", id,
				"error", err,
			)
			return "", fmt.Errorf("error starting new terminal '%s': %+v", id, err)
		}

		s.logger.Infow("New terminal created",
			"terminalID", newTerm.ID,
		)

		go func() {
			defer func() {
				s.Destroy(newTerm.ID)
				err := s.exitSubs.Notify(id, struct{}{})
				if err != nil {
					s.logger.Errorw("Failed to send exit notification",
						"terminalID", id,
						"error", err,
					)
				}
			}()

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
						s.logger.Warnw("Error reading from terminal",
							"terminalID", newTerm.ID,
							"error", err,
							"isDestroyed", newTerm.IsDestroyed(),
						)
						return
					}
				}

				if read > 0 {
					data := string(buf[:read])

					err = s.dataSubs.Notify(newTerm.ID, data)
					if err != nil {
						s.logger.Errorw("Failed to send data notification",
							"terminalID", newTerm.ID,
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
					s.logger.Errorw("Failed to get child processes for terminal",
						"terminalID", newTerm.ID,
						"pid", pid,
						"error", err,
						"isDestroyed", newTerm.IsDestroyed(),
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
						"terminalID", newTerm.ID,
						"error", err,
					)
				}
			}
		}()

		s.logger.Infow("Started new terminal",
			"terminalID", newTerm.ID,
		)
		return newTerm.ID, nil
	}

	s.logger.Infow("Terminal with this ID already exists",
		"terminalID", id,
	)
	return term.ID, nil
}

func (s *Service) Data(id ID, data string) error {
	term, ok := s.terminals.Get(id)

	if !ok {
		s.logger.Errorw("Failed to find terminal",
			"terminalID", id,
		)
		return fmt.Errorf("error finding terminal '%s'", id)
	}

	if _, err := term.Write([]byte(data)); err != nil {
		s.logger.Errorw("Failed to write data to terminal",
			"terminalID", id,
			"error", err,
			"data", data,
			"isDestroyed", term.IsDestroyed(),
		)
		return fmt.Errorf("error writing data to terminal '%s': %+v", id, err)
	}

	return nil
}

func (s *Service) Resize(id ID, cols, rows uint16) error {
	s.logger.Infow("Resize terminal",
		"terminalID", id,
	)

	term, ok := s.terminals.Get(id)

	if !ok {
		s.logger.Errorw("Failed finding terminal",
			"terminalID", id,
		)
		return fmt.Errorf("error finding terminal '%s'", id)
	}

	if err := term.Resize(cols, rows); err != nil {
		s.logger.Errorw("Failed resizing terminal",
			"terminalID", id,
			"error", err,
			"cols", cols,
			"rows", rows,
			"isDestroyed", term.IsDestroyed(),
		)
		return fmt.Errorf("error resizing terminal '%s': %+v", id, err)
	}

	return nil
}

func (s *Service) Destroy(id ID) {
	s.logger.Infow("Destroy terminal",
		"terminalID", id,
	)

	s.terminals.Remove(id)
}

func (s *Service) KillProcess(pid int) error {
	s.logger.Infow("Kill child process",
		"pid", pid,
	)

	if err := process.KillChildProcess(pid); err != nil {
		s.logger.Errorw("Failed killing child process",
			"pid", pid,
			"error", err,
		)
		return fmt.Errorf("error killing child process '%d': %+v", pid, err)
	}
	return nil
}

// Subscription
func (s *Service) OnData(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Infow("Subscribe to terminal data",
		"terminalID", id,
	)

	sub, lastUnsubscribed, err := s.dataSubs.Create(ctx, id)
	if err != nil {
		s.logger.Errorw("Failed to create a data subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	go func() {
		<-lastUnsubscribed

		if !s.hasSubscibers(id) {
			s.Destroy(id)
		}
	}()

	return sub.Subscription, nil
}

// Subscription
func (s *Service) OnChildProcessesChange(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Infow("Subscribe to terminal child processes",
		"terminalID", id,
	)

	sub, lastUnsubscribed, err := s.childProcessesSubs.Create(ctx, id)
	if err != nil {
		s.logger.Errorw("Failed to create a terminal child processes subscription",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	go func() {
		<-lastUnsubscribed

		if !s.hasSubscibers(id) {
			s.Destroy(id)
		}
	}()

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

// Subscription
func (s *Service) OnExit(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Info("Subscribe to terminal exit")

	sub, lastUnsubscribed, err := s.exitSubs.Create(ctx, id)
	if err != nil {
		s.logger.Errorw("Failed to create an exit subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	go func() {
		<-lastUnsubscribed

		if !s.hasSubscibers(id) {
			s.Destroy(id)
		}
	}()

	term, ok := s.terminals.Get(id)

	if ok {
		// Send exit if the terminal process already exited
		if term.IsDestroyed() {
			if err := sub.Notify(struct{}{}); err != nil {
				s.logger.Errorw("Failed to send on exit notification",
					"terminalID", id,
					"subID", sub.Subscription.ID,
					"error", err,
				)
			}
		}
	}

	return sub.Subscription, nil
}

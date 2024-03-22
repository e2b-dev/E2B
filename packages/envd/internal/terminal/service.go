package terminal

import (
	"context"
	"fmt"
	"io"

	"github.com/ethereum/go-ethereum/rpc"
	"github.com/rs/xid"
	"go.uber.org/zap"

	"github.com/e2b-dev/infra/packages/envd/internal/clock"
	"github.com/e2b-dev/infra/packages/envd/internal/env"
	"github.com/e2b-dev/infra/packages/envd/internal/subscriber"
)

type Service struct {
	logger *zap.SugaredLogger
	env    *env.EnvConfig

	terminals *Manager

	clock *clock.Service

	dataSubs *subscriber.Manager
	exitSubs *subscriber.Manager
}

func NewService(logger *zap.SugaredLogger, env *env.EnvConfig, clock *clock.Service) *Service {
	return &Service{
		logger: logger,

		clock: clock,

		env:       env,
		terminals: NewManager(logger),

		dataSubs: subscriber.NewManager("terminal/dataSubs", logger.Named("subscriber.terminal.dataSubs")),
		exitSubs: subscriber.NewManager("terminal/exitSubs", logger.Named("subscriber.terminal.exitSubs")),
	}
}

type dataWriter struct {
	dataSubs   *subscriber.Manager
	terminalID string
}

func (d *dataWriter) Write(p []byte) (int, error) {
	err := d.dataSubs.Notify(d.terminalID, string(p))

	return len(p), err
}

func (s *Service) dataSubsWriter(terminalID string) io.Writer {
	return &dataWriter{
		terminalID: terminalID,
		dataSubs:   s.dataSubs,
	}
}

func (s *Service) hasSubscibers(id ID) bool {
	return s.exitSubs.Has(id) || s.dataSubs.Has(id)
}

func (s *Service) Start(id ID, cols, rows uint16, envVars *map[string]string, cmd, rootdir *string) (ID, error) {
	s.logger.Debugw("Start terminal",
		"terminalID", id,
	)

	term, ok := s.terminals.Get(id)

	// Terminal doesn't exist, we will create a new one.
	if !ok {
		s.logger.Debugw("Terminal with ID doesn't exist yet. Creating a new terminal",
			"requestedTerminalID", id,
		)

		id := id
		if id == "" {
			id = xid.New().String()
		}

		// We need to wait for the clock to sync before we start the process.
		s.clock.Wait()

		newTerm, err := s.terminals.Add(
			id,
			s.env.Shell,
			rootdir,
			cols,
			rows,
			envVars,
			cmd,
		)
		if err != nil {
			s.logger.Errorw("Failed to start new terminal",
				"terminalID", id,
				"error", err,
			)

			return "", fmt.Errorf("error starting new terminal '%s': %w", id, err)
		}

		s.logger.Debugw("New terminal created",
			"terminalID", newTerm.ID,
		)

		writer := s.dataSubsWriter(newTerm.ID)

		go func() {
			_, copyErr := io.Copy(writer, newTerm.tty)
			if copyErr != nil {
				s.logger.Warnw("Error reading from terminal",
					"terminalID", newTerm.ID,
					"error", copyErr,
				)
			}

			s.terminals.Remove(newTerm.ID)
			s.logger.Debugw("Sending terminal exit notification", "terminalID", newTerm.ID)
			notifyErr := s.exitSubs.Notify(id, struct{}{})

			if notifyErr != nil {
				s.logger.Errorw("Failed to send exit notification",
					"terminalID", id,
					"error", notifyErr,
				)
			} else {
				s.logger.Debugw("Sent terminal exit notification", "terminalID", newTerm.ID)
			}
		}()

		s.logger.Infow("Started new terminal",
			"terminalID", newTerm.ID,
		)

		return newTerm.ID, nil
	}

	s.logger.Warnw("Terminal with this ID already exists",
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

	if err := term.Write([]byte(data)); err != nil {
		s.logger.Errorw("Failed to write data to terminal",
			"terminalID", id,
			"error", err,
			"data", data,
		)

		return fmt.Errorf("error writing data to terminal '%s': %w", id, err)
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
		)

		return fmt.Errorf("error resizing terminal '%s': %w", id, err)
	}

	return nil
}

func (s *Service) Destroy(id ID) {
	s.logger.Infow("Destroy terminal",
		"terminalID", id,
	)

	s.terminals.Remove(id)
}

// Subscription
func (s *Service) OnData(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Debugw("Subscribing to terminal data",
		"terminalID", id,
	)

	sub, lastUnsubscribed, err := s.dataSubs.Create(ctx, id)
	if err != nil {
		s.logger.Errorw("Failed to create a data subscription from context",
			"ctx", ctx,
			"error", err,
		)

		return nil, fmt.Errorf("error creating a data subscription from context: %w", err)
	}

	go func() {
		<-lastUnsubscribed

		if !s.hasSubscibers(id) {
			s.terminals.Remove(id)
		}
	}()

	s.logger.Debugw("Subscribed to terminal data",
		"terminalID", id,
		"subID", sub.Subscription.ID,
	)

	return sub.Subscription, nil
}

// Subscription
func (s *Service) OnExit(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Debugw("Subscribing to terminal exit", "terminalID", id)

	sub, lastUnsubscribed, err := s.exitSubs.Create(ctx, id)
	if err != nil {
		s.logger.Errorw("Failed to create an exit subscription from context",
			"ctx", ctx,
			"error", err,
		)

		return nil, fmt.Errorf("error creating an exit subscription from context: %w", err)
	}

	go func() {
		<-lastUnsubscribed

		if !s.hasSubscibers(id) {
			s.terminals.Remove(id)
		}
	}()

	s.logger.Debugw("Subscribed to terminal exit",
		"terminalID", id,
		"subID", sub.Subscription.ID,
	)

	return sub.Subscription, nil
}

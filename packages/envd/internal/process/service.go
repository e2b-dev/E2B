package process

import (
	"bufio"
	"context"
	"fmt"
	"io"

	"github.com/ethereum/go-ethereum/rpc"
	"github.com/rs/xid"
	"go.uber.org/zap"

	"github.com/e2b-dev/api/packages/envd/internal/output"
	"github.com/e2b-dev/api/packages/envd/internal/subscriber"
)

type Service struct {
	logger *zap.SugaredLogger

	processes *Manager

	stdoutSubs *subscriber.Manager
	stderrSubs *subscriber.Manager
	exitSubs   *subscriber.Manager
}

func NewService(logger *zap.SugaredLogger) *Service {
	return &Service{
		logger:    logger,
		processes: NewManager(logger),

		stdoutSubs: subscriber.NewManager("process/stdoutSubs", logger.Named("subscriber.process.stdoutSubs")),
		stderrSubs: subscriber.NewManager("process/stderrSubs", logger.Named("subscriber.process.stderrSubs")),
		exitSubs:   subscriber.NewManager("process/exitSubs", logger.Named("subscriber.process.exitSubs")),
	}
}

func (s *Service) hasSubscibers(id ID) bool {
	return s.exitSubs.Has(id) ||
		s.stdoutSubs.Has(id) ||
		s.stderrSubs.Has(id)
}

func (s *Service) scanRunCmdOut(pipe io.ReadCloser, t output.OutType, process *Process) {
	scanner := bufio.NewScanner(pipe)
	for scanner.Scan() {
		line := scanner.Text()

		var o output.OutMessage
		switch t {
		case output.OutTypeStdout:
			o = output.NewStdoutMessage(line)
			err := s.stdoutSubs.Notify(process.ID, o)
			if err != nil {
				s.logger.Errorw("Failed to send stdout notification",
					"error", err,
				)
			}
		case output.OutTypeStderr:
			o = output.NewStderrMessage(line)
			err := s.stderrSubs.Notify(process.ID, o)
			if err != nil {
				s.logger.Errorw("Failed to send stderr notification",
					"error", err,
				)
			}
		}
	}

	err := pipe.Close()
	if err != nil {
		s.logger.Warnw("Failed to close pipe",
			"error", err,
		)
	}
}

func (s *Service) Start(id ID, cmd string, envVars *map[string]string, rootdir string) (ID, error) {
	s.logger.Infow("Start process",
		"processID", id,
	)

	proc, ok := s.processes.Get(id)

	// Process doesn't exist, we will create a new one.
	if !ok {
		s.logger.Infow("Process with ID doesn't exist yet. Creating a new process",
			"requestedProcessID", id,
		)

		id := id
		if id == "" {
			id = xid.New().String()
		}

		newProc, err := s.processes.Add(id, cmd, envVars, rootdir)
		if err != nil {
			s.logger.Errorw("Failed to create new process",
				"processID", id,
				"error", err,
			)
			return "", err
		}

		stderr, err := newProc.cmd.StderrPipe()
		if err != nil {
			s.processes.Remove(newProc.ID)

			s.logger.Errorw("Failed to set up stderr pipe for the process",
				"processID", newProc.ID,
				"error", err,
			)

			return "", fmt.Errorf("error setting up stderr pipe for the process '%s': %w", newProc.ID, err)
		}
		go s.scanRunCmdOut(stderr, output.OutTypeStderr, newProc)

		stdout, err := newProc.cmd.StdoutPipe()
		if err != nil {
			s.processes.Remove(newProc.ID)
			pipeErr := stderr.Close()
			if pipeErr != nil {
				s.logger.Warnw("Failed to close pipe",
					"error", pipeErr,
				)
			}

			s.logger.Errorw("Failed to set up stdout pipe for the process",
				"processID", newProc.ID,
				"error", err,
			)
			return "", fmt.Errorf("error setting up stdout pipe for the process '%s': %w", newProc.ID, err)
		}
		go s.scanRunCmdOut(stdout, output.OutTypeStdout, newProc)

		stdin, err := newProc.cmd.StdinPipe()
		if err != nil {
			s.processes.Remove(newProc.ID)
			pipeErr := stdout.Close()
			if pipeErr != nil {
				s.logger.Warnw("Failed to close pipe",
					"error", pipeErr,
				)
			}
			pipeErr = stderr.Close()
			if pipeErr != nil {
				s.logger.Warnw("Failed to close pipe",
					"error", err,
				)
			}

			s.logger.Errorw("Failed to set up stdin pipe for the process",
				"processID", newProc.ID,
				"error", err,
			)

			return "", fmt.Errorf("error setting up stdin pipe for the process '%s': %w", newProc.ID, err)
		}
		newProc.Stdin = &stdin

		if err := newProc.cmd.Start(); err != nil {
			s.processes.Remove(newProc.ID)
			pipeErr := stdout.Close()
			if pipeErr != nil {
				s.logger.Warnw("Failed to close pipe",
					"error", pipeErr,
				)
			}

			pipeErr = stderr.Close()
			if pipeErr != nil {
				s.logger.Warnw("Failed to close pipe",
					"error", pipeErr,
				)
			}

			pipeErr = stdin.Close()
			if pipeErr != nil {
				s.logger.Warnw("Failed to close pipe",
					"error", pipeErr,
				)
			}

			s.logger.Errorw("Failed to start process",
				"processID", newProc.ID,
				"error", err,
				"cmd", newProc.cmd,
			)
			return "", fmt.Errorf("error starting process '%s': %w", newProc.ID, err)
		}

		go func() {
			defer func() {
				s.processes.Remove(newProc.ID)
				pipeErr := stdin.Close()
				if pipeErr != nil {
					s.logger.Warnw("Failed to close pipe",
						"error", pipeErr,
					)
				}

				err = s.exitSubs.Notify(newProc.ID, struct{}{})
				if err != nil {
					s.logger.Errorw("Failed to send exit notification",
						"processID", newProc.ID,
						"error", err,
					)
				}
			}()

			err := newProc.cmd.Wait()
			if err != nil {
				s.logger.Warnw("Failed waiting for process",
					"processID", newProc.ID,
					"error", err,
				)
			}
		}()

		s.logger.Infow("Started new process", "processID", newProc.ID)
		return newProc.ID, nil
	}

	s.logger.Infow("Process with this ID already exists",
		"processID", id,
	)
	return proc.ID, nil
}

func (s *Service) Stdin(id ID, data string) error {
	s.logger.Infow("Handle process stdin",
		"processID", id,
	)

	proc, ok := s.processes.Get(id)

	if !ok {
		s.logger.Errorw("Failed to find process",
			"processID", id,
		)
		return fmt.Errorf("error finding process '%s'", id)
	}

	err := proc.WriteStdin(data)
	if err != nil {
		s.logger.Errorw("Failed to write stdin",
			"processID", id,
			"error", err,
			"stdin", data,
		)
		return fmt.Errorf("error writing stdin to process '%s': %w", id, err)
	}

	return nil
}

func (s *Service) Kill(id ID) {
	s.logger.Info("Kill process",
		"processID", id,
	)

	s.processes.Remove(id)
}

// Subscription
func (s *Service) OnExit(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Infow("Subscribing to process exit", "processID", id)

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
			s.processes.Remove(id)
		}
	}()

	s.logger.Infow("Subscribed to process exit", "processID", id, "subID", sub.Subscription.ID)

	return sub.Subscription, nil
}

// Subscription
func (s *Service) OnStdout(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Infow("Subscribing to process stdout",
		"processID", id,
	)

	sub, lastUnsubscribed, err := s.stdoutSubs.Create(ctx, id)
	if err != nil {
		s.logger.Errorw("Failed to create a stdout subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	go func() {
		<-lastUnsubscribed

		if !s.hasSubscibers(id) {
			s.processes.Remove(id)
		}
	}()

	s.logger.Infow("Subscribing to process stdout",
		"processID", id,
		"subID", sub.Subscription.ID,
	)

	return sub.Subscription, nil
}

// Subscription
func (s *Service) OnStderr(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Infow("Subscribe to process stderr",
		"processID", id,
	)

	sub, lastUnsubscribed, err := s.stderrSubs.Create(ctx, id)
	if err != nil {
		s.logger.Errorw("Failed to create a stderr subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	go func() {
		<-lastUnsubscribed

		if !s.hasSubscibers(id) {
			s.processes.Remove(id)
		}
	}()

	s.logger.Infow("Subscribe to process stderr",
		"processID", id,
		"subID", sub.Subscription.ID,
	)

	return sub.Subscription, nil
}

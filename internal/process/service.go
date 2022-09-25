package process

import (
	"bufio"
	"context"
	"fmt"
	"io"

	"github.com/devbookhq/devbookd/internal/output"
	"github.com/devbookhq/devbookd/internal/subscriber"
	"github.com/ethereum/go-ethereum/rpc"
	"github.com/rs/xid"
	"go.uber.org/zap"
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
		processes: NewManager(),

		stdoutSubs: subscriber.NewManager(),
		stderrSubs: subscriber.NewManager(),
		exitSubs:   subscriber.NewManager(),
	}
}

func (s *Service) hasSubscibers(id ID) bool {
	return s.exitSubs.HasSubscribers(id) ||
		s.stdoutSubs.HasSubscribers(id) ||
		s.stderrSubs.HasSubscribers(id)
}

func (s *Service) scanRunCmdOut(pipe io.ReadCloser, t output.OutType, process *Process) {
	scanner := bufio.NewScanner(pipe)
	for scanner.Scan() {
		line := scanner.Text()

		var o output.OutResponse
		switch t {
		case output.OutTypeStdout:
			o = output.NewStdoutResponse(line)
			err := s.stdoutSubs.Notify(process.ID, o)
			if err != nil {
				s.logger.Errorw("Failed to send stdout notification",
					"error", err,
				)
			}
		case output.OutTypeStderr:
			o = output.NewStderrResponse(line)
			err := s.stderrSubs.Notify(process.ID, o)
			if err != nil {
				s.logger.Errorw("Failed to send stderr notification",
					"error", err,
				)
			}
		}
	}

	pipe.Close()
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

		newProc, err := s.processes.Add(id, cmd, envVars, rootdir, s.logger)
		if err != nil {
			s.logger.Errorw("Failed to create new process",
				"processID", id,
				"error", err,
			)
			return "", err
		}

		stdout, err := newProc.cmd.StdoutPipe()
		if err != nil {
			newProc.SetHasExited(true)
			s.processes.Remove(newProc.ID)
			s.logger.Errorw("Failed to set up stdout pipe for the process",
				"processID", newProc.ID,
				"error", err,
			)
			return "", fmt.Errorf("error setting up stdout pipe for the process '%s': %+v", newProc.ID, err)
		}
		go s.scanRunCmdOut(stdout, output.OutTypeStdout, newProc)

		stderr, err := newProc.cmd.StderrPipe()
		if err != nil {
			newProc.SetHasExited(true)
			stdout.Close()
			s.processes.Remove(newProc.ID)

			s.logger.Errorw("Failed to set up stderr pipe for the process",
				"processID", newProc.ID,
				"error", err,
			)
			return "", fmt.Errorf("error setting up stderr pipe for the process '%s': %+v", newProc.ID, err)
		}
		go s.scanRunCmdOut(stderr, output.OutTypeStderr, newProc)

		stdin, err := newProc.cmd.StdinPipe()
		if err != nil {
			newProc.SetHasExited(true)
			stdout.Close()
			stderr.Close()
			s.processes.Remove(newProc.ID)

			s.logger.Errorw("Failed to set up stdin pipe for the process",
				"processID", newProc.ID,
				"error", err,
			)
			return "", fmt.Errorf("error setting up stdin pipe for the process '%s': %+v", newProc.ID, err)
		}
		newProc.Stdin = &stdin

		if err := newProc.cmd.Start(); err != nil {
			s.logger.Errorw("Failed to start process",
				"processID", newProc.ID,
				"error", err,
				"cmd", newProc.cmd,
			)

			newProc.SetHasExited(true)

			err := s.exitSubs.Notify(newProc.ID, struct{}{})
			if err != nil {
				s.logger.Errorw("Failed to send exit notification",
					"processID", newProc.ID,
					"error", err,
				)
			}

			stdout.Close()
			stderr.Close()
			stdin.Close()

			s.processes.Remove(newProc.ID)
			return "", fmt.Errorf("error starting process '%s': %+v", newProc.ID, err)
		}

		go func() {
			defer s.processes.Remove(newProc.ID)
			defer stdin.Close()
			defer func() {
				err = s.exitSubs.Notify(newProc.ID, struct{}{})
				if err != nil {
					s.logger.Errorw("Failed to send exit notification",
						"processID", newProc.ID,
						"error", err,
					)
				}
			}()
			defer newProc.SetHasExited(true)

			if newProc.HasExited() {
				return
			}

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
	s.logger.Info("Handle process stdin",
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
		return fmt.Errorf("error writing stdin to process '%s': %+v", id, err)
	}

	return nil
}

func (s *Service) Kill(id ID) error {
	s.logger.Info("Kill process",
		"processID", id,
	)

	s.processes.Remove(id)
	return nil
}

// Subscription
func (s *Service) OnExit(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Info("Subscribe to process exit")

	sub, lastUnsubscribed, err := s.exitSubs.Add(ctx, id, s.logger)
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

	proc, ok := s.processes.Get(id)

	if ok {
		// Send exit if the process already exited
		if proc.HasExited() {
			if err := sub.Notify(struct{}{}); err != nil {
				s.logger.Errorw("Failed to send initial exit notification",
					"processID", id,
					"subID", sub.Subscription.ID,
					"error", err,
				)
			}
		}
	}

	return sub.Subscription, nil
}

// Subscription
func (s *Service) OnStdout(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Info("Subscribe to process stdout",
		"processID", id,
	)

	sub, lastUnsubscribed, err := s.stdoutSubs.Add(ctx, id, s.logger)
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

	return sub.Subscription, nil
}

// Subscription
func (s *Service) OnStderr(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Info("Subscribe to process stderr",
		"processID", id,
	)

	sub, lastUnsubscribed, err := s.stderrSubs.Add(ctx, id, s.logger)
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

	return sub.Subscription, nil
}

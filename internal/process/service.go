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

// Subscription
func (s *Service) OnStdout(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Info("Subscribe to process stdout")

	sub, err := s.stdoutSubs.Add(ctx, id, s.logger)
	if err != nil {
		s.logger.Errorw("Failed to create a stdout subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	return sub.Subscription, nil
}

// Subscription
func (s *Service) OnStderr(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Info("Subscribe to process stderr")

	sub, err := s.stderrSubs.Add(ctx, id, s.logger)
	if err != nil {
		s.logger.Errorw("Failed to create a stderr subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	return sub.Subscription, nil
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
				s.logger.Errorf("Failed to send stdout notification")
			}
		case output.OutTypeStderr:
			o = output.NewStderrResponse(line)
			err := s.stderrSubs.Notify(process.ID, o)
			if err != nil {
				s.logger.Errorf("Failed to send stderr notification")
			}
		}
	}

	pipe.Close()
}

func (s *Service) Start(id ID, cmd string, envVars *map[string]string, rootdir string) (ID, error) {
	s.logger.Info("Starting process")

	proc, ok := s.processes.Get(id)

	// Process doesn't exist, we will create a new one.
	if !ok {
		s.logger.Info("Starting a new process")

		id := id
		if id == "" {
			id = xid.New().String()
		}

		newProc, err := s.processes.Add(id, cmd, envVars, rootdir)
		if err != nil {
			errMsg := fmt.Sprintf("Failed to create the process: %v", err)
			s.logger.Info(errMsg)
			return "", fmt.Errorf(errMsg)
		}

		stdout, err := newProc.Cmd.StdoutPipe()
		if err != nil {
			newProc.SetHasExited(true)
			s.processes.Remove(newProc.ID)

			errMsg := fmt.Sprintf("Failed to set up stdout pipe for the process: %v", err)
			s.logger.Error(errMsg)
			return "", fmt.Errorf(errMsg)
		}
		go s.scanRunCmdOut(stdout, output.OutTypeStdout, newProc)

		stderr, err := newProc.Cmd.StderrPipe()
		if err != nil {
			newProc.SetHasExited(true)
			stdout.Close()
			s.processes.Remove(newProc.ID)

			errMsg := fmt.Sprintf("Failed to set up stderr pipe for the procces: %v", err)
			s.logger.Error(errMsg)
			return "", fmt.Errorf(errMsg)
		}
		go s.scanRunCmdOut(stderr, output.OutTypeStderr, newProc)

		stdin, err := newProc.Cmd.StdinPipe()
		if err != nil {
			newProc.SetHasExited(true)
			stdout.Close()
			stderr.Close()
			s.processes.Remove(newProc.ID)

			errMsg := fmt.Sprintf("Failed to set up stdin pipe for the procces: %v", err)
			s.logger.Error(errMsg)
			return "", fmt.Errorf(errMsg)
		}
		newProc.Stdin = &stdin

		if err := newProc.Cmd.Start(); err != nil {
			errMsg := fmt.Sprintf("Failed to start the process: %v", err)
			s.logger.Error(errMsg)

			newProc.SetHasExited(true)

			err := s.exitSubs.Notify(newProc.ID, struct{}{})
			if err != nil {
				s.logger.Errorf("Failed to send exit notification %+v", err)
			}

			stdout.Close()
			stderr.Close()
			stdin.Close()

			s.processes.Remove(newProc.ID)
			return "", fmt.Errorf(errMsg)
		}

		go func() {
			defer s.processes.Remove(newProc.ID)
			defer stdin.Close()
			defer func() {
				err = s.exitSubs.Notify(newProc.ID, struct{}{})
				if err != nil {
					s.logger.Errorf("Failed to send exit notification %+v", err)
				}
			}()

			if newProc.hasExited {
				return
			}

			err := newProc.Cmd.Wait()
			if err != nil {
				s.logger.Error(err)
			}

			newProc.SetHasExited(true)
		}()

		s.logger.Info("New process started")

		return newProc.ID, nil
	}

	return proc.ID, nil
}

func (s *Service) Stdin(id ID, data string) error {
	proc, ok := s.processes.Get(id)

	if !ok {
		errMsg := fmt.Sprintf("cannot find process with ID %s", id)
		s.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	err := proc.WriteStdin(data)

	if err != nil {
		errMsg := fmt.Sprintf("cannot write stdin to process with ID %s: %+v", id, err)
		s.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	return nil
}

func (s *Service) Kill(id ID) error {
	s.logger.Info("Kill")

	s.processes.Remove(id)

	return nil
}

func (s *Service) Unsubscribe(subID rpc.ID) error {
	s.logger.Info("Unsubscribe")

	s.exitSubs.RemoveBySubID(subID)
	s.stderrSubs.RemoveBySubID(subID)
	s.stdoutSubs.RemoveBySubID(subID)

	return nil
}

// Subscription
func (s *Service) OnExit(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Info("Subscribe to process exit")

	sub, err := s.exitSubs.Add(ctx, id, s.logger)
	if err != nil {
		s.logger.Errorw("Failed to create and exit subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	proc, ok := s.processes.Get(id)

	if ok {
		// Send exit if the process already exited
		if proc.HasExited() {
			if err := sub.Notify(struct{}{}); err != nil {
				s.logger.Errorw("Failed to send initial state notification",
					"subID", sub.Subscription.ID,
					"error", err,
				)
			}
		}
	}

	return sub.Subscription, nil
}

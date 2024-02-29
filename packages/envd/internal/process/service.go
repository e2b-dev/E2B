package process

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"sync"

	"github.com/e2b-dev/infra/packages/envd/internal/env"
	"github.com/e2b-dev/infra/packages/envd/internal/output"
	"github.com/e2b-dev/infra/packages/envd/internal/subscriber"
	"github.com/ethereum/go-ethereum/rpc"
	"github.com/rs/xid"
	"go.uber.org/zap"
)

type Service struct {
	stdoutSubs *subscriber.Manager
	stderrSubs *subscriber.Manager
	exitSubs   *subscriber.Manager

	logger *zap.SugaredLogger
	env    *env.EnvConfig

	processes *Manager
}

const maxScanCapacity = 50 * 1024 * 1024 // 1024MB

func NewService(logger *zap.SugaredLogger, env *env.EnvConfig) *Service {
	return &Service{
		logger:    logger,
		processes: NewManager(logger),

		env: env,

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

func (s *Service) scanRunCmdOut(pipe io.Reader, t output.OutType, process *Process, wg *sync.WaitGroup) {
	defer wg.Done()

	// Pipe should be automatically closed when the process exits -> this should EOF the scanner.
	scanner := bufio.NewScanner(pipe)

	buf := make([]byte, 0, maxScanCapacity)
	scanner.Buffer(buf, maxScanCapacity)

	// The default max buffer size is 64k - we are increasing this to 1024MB.
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

			s.logger.Debugw("Stdout message",
				"processID", process.ID,
				"message", line,
			)

		case output.OutTypeStderr:
			o = output.NewStderrMessage(line)

			err := s.stderrSubs.Notify(process.ID, o)
			if err != nil {
				s.logger.Errorw("Failed to send stderr notification",
					"error", err,
				)
			}

			s.logger.Debugw("Stderr message",
				"processID", process.ID,
				"message", line,
			)
		}
	}

	scanErr := scanner.Err()
	if scanErr != nil {
		s.logger.Errorw("Scanner error",
			"error", scanErr,
		)
	}
}

func (s *Service) Start(id ID, cmd string, envVars *map[string]string, rootdir string) (ID, error) {
	s.logger.Infow("Start process",
		"processID", id,
		"cmd", cmd,
		"rootdir", rootdir,
	)

	proc, ok := s.processes.Get(id)
	// Process doesn't exist, we will create a new one.
	if !ok {
		s.logger.Debugw("Process with ID doesn't exist yet. Creating a new process",
			"requestedProcessID", id,
		)

		var waitForOutputHandlers sync.WaitGroup

		id := id
		if id == "" {
			id = xid.New().String()
		}

		newProc, err := s.processes.Add(id, s.env.Shell, cmd, envVars, rootdir)
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

		waitForOutputHandlers.Add(1)

		go s.scanRunCmdOut(stderr, output.OutTypeStderr, newProc, &waitForOutputHandlers)

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

		waitForOutputHandlers.Add(1)

		go s.scanRunCmdOut(stdout, output.OutTypeStdout, newProc, &waitForOutputHandlers)

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

		if startErr := newProc.cmd.Start(); startErr != nil {
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

			return "", fmt.Errorf("error starting process '%s': %w", newProc.ID, startErr)
		}

		go func() {
			waitForOutputHandlers.Wait()

			// We need to wait for all pipe closes to finish before we can wait for the process to exit (mentioned in the docs).
			if waitErr := newProc.cmd.Wait(); waitErr != nil {
				s.logger.Warnw("Failed waiting for process",
					"processID", newProc.ID,
					"error", err,
				)
			}

			s.processes.Remove(newProc.ID)

			if pipeErr := stdin.Close(); pipeErr != nil {
				s.logger.Warnw("Failed to close pipe",
					"error", pipeErr,
				)
			}

			err = s.exitSubs.Notify(newProc.ID, newProc.cmd.ProcessState.ExitCode())
			if err != nil {
				s.logger.Errorw("Failed to send exit notification",
					"processID", newProc.ID,
					"error", err,
				)
			}

			s.logger.Debugw("Process exited",
				"processID", newProc.ID,
				"cmd", newProc.cmd,
			)
		}()

		s.logger.Debugw("Started new process", "processID", newProc.ID)

		return newProc.ID, nil
	}

	s.logger.Warnw("Process with this ID already exists",
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
	s.logger.Debugw("Subscribing to process exit", "processID", id)

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
			s.processes.Remove(id)
		}
	}()

	s.logger.Debugw("Subscribed to process exit", "processID", id, "subID", sub.Subscription.ID)

	return sub.Subscription, nil
}

// Subscription
func (s *Service) OnStdout(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Debugw("Subscribing to process stdout",
		"processID", id,
	)

	sub, lastUnsubscribed, err := s.stdoutSubs.Create(ctx, id)
	if err != nil {
		s.logger.Errorw("Failed to create a stdout subscription from context",
			"ctx", ctx,
			"error", err,
		)

		return nil, fmt.Errorf("error creating a stdout subscription from context: %w", err)
	}

	go func() {
		<-lastUnsubscribed

		if !s.hasSubscibers(id) {
			s.processes.Remove(id)
		}
	}()

	s.logger.Debugw("Subscribed to process stdout",
		"processID", id,
		"subID", sub.Subscription.ID,
	)

	return sub.Subscription, nil
}

// Subscription
func (s *Service) OnStderr(ctx context.Context, id ID) (*rpc.Subscription, error) {
	s.logger.Debugw("Subscribing to process stderr",
		"processID", id,
	)

	sub, lastUnsubscribed, err := s.stderrSubs.Create(ctx, id)
	if err != nil {
		s.logger.Errorw("Failed to create a stderr subscription from context",
			"ctx", ctx,
			"error", err,
		)

		return nil, fmt.Errorf("error creating a stderr subscription from context: %w", err)
	}

	go func() {
		<-lastUnsubscribed

		if !s.hasSubscibers(id) {
			s.processes.Remove(id)
		}
	}()

	s.logger.Debugw("Subscribed to process stderr",
		"processID", id,
		"subID", sub.Subscription.ID,
	)

	return sub.Subscription, nil
}

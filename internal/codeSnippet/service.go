package codeSnippet

import (
	"bufio"
	"context"
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"

	"github.com/devbookhq/devbookd/internal/env"
	"github.com/devbookhq/devbookd/internal/output"
	"github.com/devbookhq/devbookd/internal/port"
	"github.com/devbookhq/devbookd/internal/subscriber"
	"github.com/drael/GOnetstat"
	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"
)

type CodeSnippetState string

type ErrResponse struct {
	Error string `json:"error"`
}

const (
	CodeSnippetStateRunning CodeSnippetState = "Running"
	CodeSnippetStateStopped CodeSnippetState = "Stopped"
)

// TODO: I'm not really sure if we're using RPC Notifier and Subscriber in the right way.
// There isn't an explicit documentation, I'm using source code of tests as a reference:
// https://cs.github.com/ethereum/go-ethereum/blob/440c9fcf75d9d5383b72646a65d5e21fa7ab6a26/rpc/testservice_test.go#L160

type Service struct {
	logger *zap.SugaredLogger
	env    *env.Env

	mu sync.RWMutex

	// The reason for caching cmd's outputs is if a client connects while the command
	// is already running we can send all the output that has happened since the start
	// of the command.
	// This way a user on the frontend doesn't even notice that command has been running.
	cachedOut []output.OutResponse
	running   bool
	cmd       *exec.Cmd

	stdoutSubs          *subscriber.Manager
	stderrSubs          *subscriber.Manager
	stateSubs           *subscriber.Manager
	scanOpenedPortsSubs *subscriber.Manager

	scannerSubscriber *port.ScannerSubscriber
}

func NewService(
	logger *zap.SugaredLogger,
	env *env.Env,
	portScanner *port.Scanner,
) *Service {
	scannerSub := portScanner.AddSubscriber(
		"code-snippet-service",
		nil,
	)

	cs := &Service{
		logger: logger,
		env:    env,

		scannerSubscriber: scannerSub,

		stdoutSubs:          subscriber.NewManager(),
		stderrSubs:          subscriber.NewManager(),
		stateSubs:           subscriber.NewManager(),
		scanOpenedPortsSubs: subscriber.NewManager(),
	}

	go cs.listenToOpenPorts()

	return cs
}

func (s *Service) getCachedOut() []output.OutResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list := make([]output.OutResponse, len(s.cachedOut))
	copy(list, s.cachedOut)

	return list
}

func (s *Service) setCachedOut(out []output.OutResponse) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cachedOut = out
}

func (s *Service) addToCachedOut(o output.OutResponse) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.cachedOut = append(s.cachedOut, o)
}

func (s *Service) isRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.running
}

func (s *Service) setRunning(b bool) {
	s.mu.Lock()
	s.running = b
	s.mu.Unlock()

	var state CodeSnippetState
	if b {
		state = CodeSnippetStateRunning
	} else {
		state = CodeSnippetStateStopped
	}
	s.notifyState(state)
}

func (s *Service) listenToOpenPorts() {
	for {
		if procs, ok := <-s.scannerSubscriber.Messages; ok {
			s.notifyScanOpenedPorts(procs)
		}
	}
}

func (s *Service) notifyScanOpenedPorts(ports []GOnetstat.Process) {
	err := s.scanOpenedPortsSubs.Notify("", ports)
	if err != nil {
		s.logger.Errorw("Failed to send scan opened ports notification",
			"error", err,
		)
	}
}

func (s *Service) notifyOut(o *output.OutResponse) {
	switch o.Type {
	case output.OutTypeStdout:
		err := s.stdoutSubs.Notify("", o)
		if err != nil {
			s.logger.Errorw("Failed to send stdout notification",
				"error", err,
			)
		}
	case output.OutTypeStderr:
		err := s.stderrSubs.Notify("", o)
		if err != nil {
			s.logger.Errorw("Failed to send stderr notification",
				"error", err,
			)
		}
	}
}

func (s *Service) notifyState(state CodeSnippetState) {
	err := s.stateSubs.Notify("", state)
	if err != nil {
		s.logger.Errorw("Failed to send state notification",
			"error", err,
		)
	}
}

func (s *Service) scanRunCmdOut(pipe io.ReadCloser, t output.OutType) {
	scanner := bufio.NewScanner(pipe)

	for scanner.Scan() {
		line := scanner.Text()
		var o output.OutResponse

		switch t {
		case output.OutTypeStdout:
			o = output.NewStdoutResponse(line)
		case output.OutTypeStderr:
			o = output.NewStderrResponse(line)
		}

		s.addToCachedOut(o)
		s.notifyOut(&o)
	}

	pipe.Close()
}

func (s *Service) runCmd(code string, envVars *map[string]string) {
	defer s.setRunning(false)
	defer s.setCachedOut(nil)

	if err := os.WriteFile(s.env.EntrypointFullPath(), []byte(code), 0755); err != nil {
		s.logger.Errorw("Failed to write to the entrypoint file",
			"entrypointFullPath", s.env.EntrypointFullPath(),
			"error", err,
		)
	}

	cmdToExecute := s.env.RunCMD()

	for _, arg := range s.env.ParsedRunArgs() {
		cmdToExecute = cmdToExecute + " " + arg
	}

	s.mu.Lock()
	s.cmd = exec.Command("sh", "-c", "-l", cmdToExecute)
	s.mu.Unlock()

	s.cmd.Dir = s.env.Workdir()

	formattedVars := os.Environ()

	for key, value := range *envVars {
		formattedVars = append(formattedVars, key+"="+value)
	}

	s.cmd.Env = formattedVars

	stderr, err := s.cmd.StderrPipe()
	if err != nil {
		s.logger.Errorw("Failed to set up stderr pipe for the run command",
			"cmd", s.cmd,
			"error", err,
		)
		o := output.NewStderrResponse(err.Error())
		s.notifyOut(&o)
		return
	}
	go s.scanRunCmdOut(stderr, output.OutTypeStderr)

	stdout, err := s.cmd.StdoutPipe()
	if err != nil {
		s.logger.Errorw("Failed to set up stdout pipe for the run command",
			"cmd", s.cmd,
			"error", err,
		)
		o := output.NewStderrResponse(err.Error())
		s.notifyOut(&o)
		stderr.Close()
		return
	}
	go s.scanRunCmdOut(stdout, output.OutTypeStdout)

	if err := s.cmd.Start(); err != nil {
		s.logger.Errorw("Failed to start cmd",
			"cmd", s.cmd,
			"error", err,
		)
		o := output.NewStderrResponse(err.Error())
		s.notifyOut(&o)
		stdout.Close()
		stderr.Close()
		return
	}
	s.cmd.Wait()
}

func (s *Service) Run(code string, envVars map[string]string) CodeSnippetState {
	s.logger.Infow("Run code snippet")

	if s.isRunning() {
		s.logger.Info("Code snippet is already running")
		return CodeSnippetStateRunning
	}
	s.setRunning(true)

	go s.runCmd(code, &envVars)
	return CodeSnippetStateRunning
}

func (s *Service) Stop() CodeSnippetState {
	s.logger.Info("Stop running code snippet")

	if !s.isRunning() {
		s.logger.Info("Code snippet is already stopped")
		return CodeSnippetStateStopped
	}

	sig := syscall.SIGTERM
	if err := s.cmd.Process.Signal(sig); err != nil {
		s.logger.Errorw("Failed to send a signal to the run command",
			"cmd", s.cmd,
			"signal", sig,
			"error", err,
		)
		o := output.NewStderrResponse(err.Error())
		s.notifyOut(&o)
	}

	s.setCachedOut(nil)
	s.setRunning(false)
	return CodeSnippetStateStopped
}

// Subscription
func (s *Service) State(ctx context.Context) (*rpc.Subscription, error) {
	s.logger.Info("Subscribe to code snippet state")

	sub, err := s.stateSubs.Add(ctx, "", s.logger)
	if err != nil {
		s.logger.Errorw("Failed to create a state subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	// Send initial state.
	var state CodeSnippetState
	if s.isRunning() {
		state = CodeSnippetStateRunning
	} else {
		state = CodeSnippetStateStopped
	}

	if err := sub.Notify(state); err != nil {
		s.logger.Errorw("Failed to send initial state notification",
			"subID", sub.Subscription.ID,
			"error", err,
		)
	}

	return sub.Subscription, nil
}

// Subscription
func (s *Service) Stdout(ctx context.Context) (*rpc.Subscription, error) {
	s.logger.Info("Subscribe to code snippet stdout")

	sub, err := s.stdoutSubs.Add(ctx, "", s.logger)
	if err != nil {
		s.logger.Errorw("Failed to create a stdout subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	// Send all the cached stdout to a new subscriber.
	for _, l := range s.getCachedOut() {
		if l.Type == output.OutTypeStdout {
			if err := sub.Notify(l); err != nil {
				s.logger.Errorw("Failed to send cached stdout notification",
					"subID", sub.Subscription.ID,
					"error", err,
				)
			}
		}
	}
	return sub.Subscription, nil
}

// Subscription
func (s *Service) Stderr(ctx context.Context) (*rpc.Subscription, error) {
	s.logger.Info("Subscribe to code snippet stderr")

	sub, err := s.stderrSubs.Add(ctx, "", s.logger)
	if err != nil {
		s.logger.Errorw("Failed to create a stderr subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	// Send all the cached stdout to a new subscriber.
	for _, l := range s.getCachedOut() {
		if l.Type == output.OutTypeStderr {
			if err := sub.Notify(l); err != nil {
				s.logger.Errorw("Failed to send cached stderr notification",
					"subID", sub.Subscription.ID,
					"error", err,
				)
			}
		}
	}
	return sub.Subscription, nil
}

// Subscription
func (s *Service) ScanOpenedPorts(ctx context.Context) (*rpc.Subscription, error) {
	s.logger.Info("Subscribe to scanning open ports")

	sub, err := s.scanOpenedPortsSubs.Add(ctx, "", s.logger)
	if err != nil {
		s.logger.Errorw("Failed to create a scan opened ports subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}
	return sub.Subscription, nil
}

package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"sync"

	"github.com/devbookhq/orchestration-services/fc-env/devbookd/pkg/process"
	"github.com/ethereum/go-ethereum/rpc"
	"github.com/rs/xid"
	"go.uber.org/zap"
)

type ProcessSubscriber struct {
	subscriber *subscriber
	processID  process.ProcessID
}

type ProcessService struct {
	procManager *process.ProcessManager

	logger *zap.SugaredLogger

	subscribersLock   sync.RWMutex
	stdoutSubscribers map[rpc.ID]*ProcessSubscriber
	stderrSubscribers map[rpc.ID]*ProcessSubscriber
	exitSubscribers   map[rpc.ID]*ProcessSubscriber
}

func (ps *ProcessService) saveNewSubscriber(ctx context.Context, subs map[rpc.ID]*ProcessSubscriber, processID process.ProcessID) (*ProcessSubscriber, error) {
	sub, err := newSubscriber(ctx)
	if err != nil {
		return nil, err
	}

	// Watch for subscription errors.
	go func() {
		err := <-sub.subscription.Err()
		ps.logger.Errorw("Subscribtion error",
			"subscriptionID", sub.SubscriptionID(),
			"error", err,
		)

		ps.removeSubscriber(subs, sub.SubscriptionID())
	}()

	wrappedSub := &ProcessSubscriber{
		processID:  processID,
		subscriber: sub,
	}

	ps.subscribersLock.Lock()
	defer ps.subscribersLock.Unlock()

	subs[sub.SubscriptionID()] = wrappedSub
	return wrappedSub, nil
}

func (ps *ProcessService) removeSubscriber(subs map[rpc.ID]*ProcessSubscriber, subscriberID rpc.ID) {
	ps.subscribersLock.Lock()
	defer ps.subscribersLock.Unlock()

	delete(subs, subscriberID)
}

func (ps *ProcessService) removeSubscribers(processID process.ProcessID, subscribers map[rpc.ID]*ProcessSubscriber) {
	for _, s := range ps.getSubscribers(subscribers, processID) {
		ps.removeSubscriber(subscribers, s.subscriber.SubscriptionID())
	}
}

func (ps *ProcessService) removeProcessSubscribers(processID process.ProcessID) {
	ps.removeSubscribers(processID, ps.exitSubscribers)
	ps.removeSubscribers(processID, ps.stdoutSubscribers)
	ps.removeSubscribers(processID, ps.stderrSubscribers)
}

func (ps *ProcessService) notifySubscribers(processID process.ProcessID, subscribers map[rpc.ID]*ProcessSubscriber, data interface{}, errMsg string) {
	for _, sub := range ps.getSubscribers(subscribers, processID) {
		if err := sub.subscriber.Notify(data); err != nil {
			ps.logger.Errorw(errMsg,
				"subscriptionID", sub.subscriber.SubscriptionID(),
				"error", err,
			)
		}
	}
}

func (ps *ProcessService) getSubscribers(subs map[rpc.ID]*ProcessSubscriber, processID process.ProcessID) []*ProcessSubscriber {
	processSubscribers := []*ProcessSubscriber{}

	ps.subscribersLock.RLock()
	defer ps.subscribersLock.RUnlock()

	for _, s := range subs {
		if s.processID == processID {
			processSubscribers = append(processSubscribers, s)
		}
	}

	return processSubscribers
}

func NewProcessService(logger *zap.SugaredLogger) *ProcessService {
	ps := &ProcessService{
		stdoutSubscribers: make(map[rpc.ID]*ProcessSubscriber),
		stderrSubscribers: make(map[rpc.ID]*ProcessSubscriber),
		exitSubscribers:   make(map[rpc.ID]*ProcessSubscriber),
		logger:            logger,
		procManager:       process.NewProcessManager(),
	}

	return ps
}

// Subscription
func (ps *ProcessService) OnStdout(ctx context.Context, processID process.ProcessID) (*rpc.Subscription, error) {
	ps.logger.Info("Subscribe to process stdout")

	sub, err := ps.saveNewSubscriber(ctx, ps.stdoutSubscribers, processID)
	if err != nil {
		ps.logger.Errorw("Failed to create a stdout subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	return sub.subscriber.subscription, nil
}

// Subscription
func (ps *ProcessService) OnStderr(ctx context.Context, processID process.ProcessID) (*rpc.Subscription, error) {
	ps.logger.Info("Subscribe to process stderr")

	sub, err := ps.saveNewSubscriber(ctx, ps.stderrSubscribers, processID)
	if err != nil {
		ps.logger.Errorw("Failed to create a stderr subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	return sub.subscriber.subscription, nil
}

func (ps *ProcessService) scanRunCmdOut(pipe io.ReadCloser, t outType, process *process.Process) {
	scanner := bufio.NewScanner(pipe)

	for scanner.Scan() {
		line := scanner.Text()

		var o OutResponse
		switch t {
		case OutTypeStdout:
			o = newStdoutResponse(line)
			ps.notifySubscribers(process.ID, ps.stdoutSubscribers, o, "Failed to send stdout notification")
		case OutTypeStderr:
			o = newStderrResponse(line)
			ps.notifySubscribers(process.ID, ps.stderrSubscribers, o, "Failed to send stderr notification")
		}
	}

	process.Cmd.Wait()
	pipe.Close()

	switch t {
	case OutTypeStdout:
		ps.removeSubscribers(process.ID, ps.stdoutSubscribers)
	case OutTypeStderr:
		ps.removeSubscribers(process.ID, ps.stderrSubscribers)
	}
}

func (ps *ProcessService) Start(processID process.ProcessID, cmd string, envVars *map[string]string, rootdir string) (process.ProcessID, error) {
	ps.logger.Info("Starting process")

	proc, ok := ps.procManager.Get(processID)

	// Process doesn't exist, we will create a new one.
	if !ok {
		ps.logger.Info("Starting a new process")

		id := processID
		if id == "" {
			id = xid.New().String()
		}

		newProc, err := ps.procManager.Add(id, cmd, envVars, rootdir)
		if err != nil {
			ps.removeProcessSubscribers(processID)

			errMsg := fmt.Sprintf("Failed to create the process: %v", err)
			ps.logger.Info(errMsg)
			return "", fmt.Errorf(errMsg)
		}

		stdout, err := newProc.Cmd.StdoutPipe()
		if err != nil {
			newProc.SetHasExited(true)
			ps.procManager.Remove(processID)
			ps.removeProcessSubscribers(processID)

			errMsg := fmt.Sprintf("Failed to set up stdout pipe for the process: %v", err)
			ps.logger.Error(errMsg)
			return "", fmt.Errorf(errMsg)
		}
		go ps.scanRunCmdOut(stdout, OutTypeStdout, newProc)

		stderr, err := newProc.Cmd.StderrPipe()
		if err != nil {
			newProc.SetHasExited(true)
			stdout.Close()
			ps.procManager.Remove(processID)
			ps.removeProcessSubscribers(processID)

			errMsg := fmt.Sprintf("Failed to set up stderr pipe for the procces: %v", err)
			ps.logger.Error(errMsg)
			return "", fmt.Errorf(errMsg)
		}
		go ps.scanRunCmdOut(stderr, OutTypeStderr, newProc)

		stdin, err := newProc.Cmd.StdinPipe()
		if err != nil {
			newProc.SetHasExited(true)
			stdout.Close()
			stderr.Close()
			ps.procManager.Remove(processID)
			ps.removeProcessSubscribers(processID)

			errMsg := fmt.Sprintf("Failed to set up stdin pipe for the procces: %v", err)
			ps.logger.Error(errMsg)
			return "", fmt.Errorf(errMsg)
		}
		newProc.Stdin = &stdin

		if err := newProc.Cmd.Start(); err != nil {
			errMsg := fmt.Sprintf("Failed to start the process: %v", err)
			ps.logger.Error(errMsg)

			newProc.SetHasExited(true)

			ps.notifySubscribers(processID, ps.exitSubscribers, struct{}{}, "Failed to send exit notification")

			stdout.Close()
			stderr.Close()
			stdin.Close()

			ps.procManager.Remove(processID)
			ps.removeProcessSubscribers(processID)

			return "", fmt.Errorf(errMsg)
		}

		go func() {
			err := newProc.Cmd.Wait()
			ps.logger.Error(err)

			newProc.SetHasExited(true)

			ps.notifySubscribers(processID, ps.exitSubscribers, struct{}{}, "Failed to send exit notification")

			stdin.Close()

			ps.procManager.Remove(processID)

			ps.removeSubscribers(processID, ps.exitSubscribers)
		}()

		ps.logger.Info("New process started")

		proc = newProc
	}

	return proc.ID, nil
}

func (ps *ProcessService) Stdin(processID process.ProcessID, data string) error {
	proc, ok := ps.procManager.Get(processID)

	if !ok {
		errMsg := fmt.Sprintf("cannot find process with ID %s", processID)
		ps.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	err := proc.WriteStdin(data)

	if err != nil {
		errMsg := fmt.Sprintf("cannot write stdin to process with ID %s: %+v", processID, err)
		ps.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	return nil
}

func (ps *ProcessService) Kill(processID process.ProcessID) error {
	ps.logger.Info("Kill")

	ps.procManager.Remove(processID)
	ps.removeProcessSubscribers(processID)

	return nil
}

// Subscription
func (ps *ProcessService) OnExit(ctx context.Context, processID process.ProcessID) (*rpc.Subscription, error) {
	ps.logger.Info("Subscribe to process exit")

	sub, err := ps.saveNewSubscriber(ctx, ps.exitSubscribers, processID)
	if err != nil {
		ps.logger.Errorw("Failed to create and exit subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	proc, ok := ps.procManager.Get(processID)

	if ok {
		// Send exit if the process already exited
		if proc.HasExited() {
			if err := sub.subscriber.Notify(struct{}{}); err != nil {
				slogger.Errorw("Failed to send initial state notification",
					"subscriptionID", sub.subscriber.SubscriptionID(),
					"error", err,
				)
			}
		}
	}

	return sub.subscriber.subscription, nil
}

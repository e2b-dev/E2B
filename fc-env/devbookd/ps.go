package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"sync"

	"github.com/devbookhq/orchestration-services/fc-env/devbookd/pkg/process"
	"github.com/ethereum/go-ethereum/rpc"
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

	_, ok := ps.procManager.Get(processID)

	if !ok {
		errMsg := fmt.Sprint("Cannot find process with ID %s", processID)
		ps.logger.Error(errMsg)
		return nil, fmt.Errorf(errMsg)
	}

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

	_, ok := ps.procManager.Get(processID)

	if !ok {
		errMsg := fmt.Sprint("Cannot find process with ID %s", processID)
		ps.logger.Error(errMsg)
		return nil, fmt.Errorf(errMsg)
	}

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
	scanner.Split(bufio.ScanLines)

	for scanner.Scan() {
		line := scanner.Text()

		var o OutResponse
		switch t {
		case OutTypeStdout:
			o = newStdoutResponse(line)
		case OutTypeStderr:
			o = newStderrResponse(line)
		}
		ps.notifyOut(&o, process)
	}

	process.Cmd.Wait()

	for _, sub := range ps.getSubscribers(ps.exitSubscribers, process.ID) {
		if err := sub.subscriber.Notify(struct{}{}); err != nil {
			ps.logger.Errorw("Failed to send exit notification",
				"subscriptionID", sub.subscriber.SubscriptionID(),
				"error", err,
			)
		}
	}

	for _, s := range ps.getSubscribers(ps.stdoutSubscribers, process.ID) {
		ps.removeSubscriber(ps.stdoutSubscribers, s.subscriber.SubscriptionID())
	}

	for _, s := range ps.getSubscribers(ps.stderrSubscribers, process.ID) {
		ps.removeSubscriber(ps.stderrSubscribers, s.subscriber.SubscriptionID())
	}

	for _, s := range ps.getSubscribers(ps.exitSubscribers, process.ID) {
		ps.removeSubscriber(ps.exitSubscribers, s.subscriber.SubscriptionID())
	}
}

func (ps *ProcessService) notifyOut(o *OutResponse, process *process.Process) {
	switch o.Type {
	case OutTypeStdout:
		for _, sub := range ps.getSubscribers(ps.stdoutSubscribers, process.ID) {
			if err := sub.subscriber.Notify(o); err != nil {
				ps.logger.Errorw("Failed to send stdout notification",
					"subscriptionID", sub.subscriber.SubscriptionID(),
					"error", err,
				)
			}
		}
	case OutTypeStderr:
		for _, sub := range ps.getSubscribers(ps.stderrSubscribers, process.ID) {
			if err := sub.subscriber.Notify(o); err != nil {
				ps.logger.Errorw("Failed to send stderr notification",
					"subscriptionID", sub.subscriber.SubscriptionID(),
					"error", err,
				)
			}
		}
	}
}

func (ps *ProcessService) Start(processID process.ProcessID, cmd string, envVars *map[string]string, rootdir string) (process.ProcessID, error) {
	ps.logger.Info("Starting process")

	proc, ok := ps.procManager.Get(processID)

	// Process doesn't exist, we will create a new one.
	if !ok {
		ps.logger.Info("Starting a new process")

		newProc, err := ps.procManager.Add(cmd, envVars, rootdir)
		if err != nil {
			errMsg := fmt.Sprintf("Failed to start process: %v", err)
			ps.logger.Info(errMsg)
			return "", fmt.Errorf(errMsg)
		}

		stdout, err := newProc.Cmd.StdoutPipe()
		if err != nil {
			slogger.Errorw("Failed to set up stdout pipe for the command",
				"cmd", cmd,
				"error", err,
			)
			o := newStderrResponse(err.Error())
			ps.notifyOut(&o, newProc)
		}
		go ps.scanRunCmdOut(stdout, OutTypeStdout, newProc)

		stderr, err := newProc.Cmd.StderrPipe()
		if err != nil {
			slogger.Errorw("Failed to set up stderr pipe for the command",
				"cmd", cmd,
				"error", err,
			)
			o := newStderrResponse(err.Error())
			ps.notifyOut(&o, newProc)
		}
		go ps.scanRunCmdOut(stderr, OutTypeStderr, newProc)

		if err := newProc.Cmd.Start(); err != nil {
			slogger.Errorw("Failed to run the run command",
				"cmd", cmd,
				"error", err,
			)
			o := newStderrResponse(err.Error())
			ps.notifyOut(&o, newProc)
		}

		ps.logger.Info("New process started")

		proc = newProc
	}

	return proc.ID, nil
}

func (ps *ProcessService) Stdin(processID process.ProcessID, data string) error {
	proc, ok := ps.procManager.Get(processID)

	if !ok {
		errMsg := fmt.Sprint("Cannot find process with ID %s", processID)
		ps.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	err := proc.WriteStdin(data)

	if err != nil {
		errMsg := fmt.Sprint("Cannot write stdin %s to process with ID %s", data, processID)
		ps.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	return nil
}

func (ps *ProcessService) Kill(processID process.ProcessID) error {
	ps.logger.Info("Kill")

	ps.procManager.Remove(processID)

	for _, s := range ps.getSubscribers(ps.stdoutSubscribers, processID) {
		ps.removeSubscriber(ps.stdoutSubscribers, s.subscriber.SubscriptionID())
	}

	for _, s := range ps.getSubscribers(ps.stderrSubscribers, processID) {
		ps.removeSubscriber(ps.stderrSubscribers, s.subscriber.SubscriptionID())
	}

	return nil
}

// Subscription
func (ps *ProcessService) OnExit(ctx context.Context, processID process.ProcessID) (*rpc.Subscription, error) {
	ps.logger.Info("Subscribe to process stderr")

	proc, ok := ps.procManager.Get(processID)

	if !ok {
		errMsg := fmt.Sprint("Cannot find process with ID %s", processID)
		ps.logger.Error(errMsg)
		return nil, fmt.Errorf(errMsg)
	}

	sub, err := ps.saveNewSubscriber(ctx, ps.exitSubscribers, processID)
	if err != nil {
		ps.logger.Errorw("Failed to create and exit subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	// Send exit if the process already exited
	if !proc.IsRunning() {
		if err := sub.subscriber.Notify(struct{}{}); err != nil {
			slogger.Errorw("Failed to send initial state notification",
				"subscriptionID", sub.subscriber.SubscriptionID(),
				"error", err,
			)
		}
	}

	return sub.subscriber.subscription, nil
}

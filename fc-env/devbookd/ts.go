package main

import (
	"context"
	"fmt"
	"reflect"
	"sync"
	"time"

	"github.com/devbookhq/orchestration-services/fc-env/devbookd/pkg/process"
	"github.com/devbookhq/orchestration-services/fc-env/devbookd/pkg/terminal"
	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"
)

const (
	terminalChildProcessCheckInterval = 400 * time.Millisecond
)

type TerminalSubscriber struct {
	subscriber *subscriber
	terminalID terminal.TerminalID
}

type TerminalService struct {
	termManager *terminal.TerminalManager

	logger *zap.SugaredLogger

	subscribersLock                   sync.RWMutex
	terminalDataSubscribers           map[rpc.ID]*TerminalSubscriber
	terminalChildProcessesSubscribers map[rpc.ID]*TerminalSubscriber
}

func (ts *TerminalService) saveNewSubscriber(ctx context.Context, subs map[rpc.ID]*TerminalSubscriber, terminalID terminal.TerminalID) (*TerminalSubscriber, error) {
	sub, err := newSubscriber(ctx)
	if err != nil {
		return nil, err
	}

	// Watch for subscription errors.
	go func() {
		err := <-sub.subscription.Err()
		ts.logger.Errorw("Subscribtion error",
			"subscriptionID", sub.SubscriptionID(),
			"error", err,
		)

		ts.removeSubscriber(subs, sub.SubscriptionID())
	}()

	wrappedSub := &TerminalSubscriber{
		terminalID: terminalID,
		subscriber: sub,
	}

	ts.subscribersLock.Lock()
	defer ts.subscribersLock.Unlock()

	subs[sub.SubscriptionID()] = wrappedSub
	return wrappedSub, nil
}

func (ts *TerminalService) removeSubscriber(subs map[rpc.ID]*TerminalSubscriber, subscriberID rpc.ID) {
	ts.subscribersLock.Lock()
	defer ts.subscribersLock.Unlock()

	delete(subs, subscriberID)
}

func (ts *TerminalService) getSubscribers(subs map[rpc.ID]*TerminalSubscriber, terminalID terminal.TerminalID) []*TerminalSubscriber {
	terminalSubscribers := []*TerminalSubscriber{}

	ts.subscribersLock.RLock()
	defer ts.subscribersLock.RUnlock()

	for _, s := range subs {
		if s.terminalID == terminalID {
			terminalSubscribers = append(terminalSubscribers, s)
		}
	}

	return terminalSubscribers
}

func NewTerminalService(logger *zap.SugaredLogger) *TerminalService {
	ts := &TerminalService{
		terminalChildProcessesSubscribers: make(map[rpc.ID]*TerminalSubscriber),
		terminalDataSubscribers:           make(map[rpc.ID]*TerminalSubscriber),
		logger:                            logger,
		termManager:                       terminal.NewTerminalManager(),
	}

	return ts
}

// Subscription
func (ts *TerminalService) OnData(ctx context.Context, terminalID terminal.TerminalID) (*rpc.Subscription, error) {
	ts.logger.Info("Subscribe to terminal data")

	_, ok := ts.termManager.Get(terminalID)

	if !ok {
		errMsg := fmt.Sprintf("cannot find terminal with ID %s", terminalID)
		ts.logger.Error(errMsg)
		return nil, fmt.Errorf(errMsg)
	}

	sub, err := ts.saveNewSubscriber(ctx, ts.terminalDataSubscribers, terminalID)
	if err != nil {
		ts.logger.Errorw("Failed to create a data subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	return sub.subscriber.subscription, nil
}

// Subscription
func (ts *TerminalService) OnChildProcessesChange(ctx context.Context, terminalID terminal.TerminalID) (*rpc.Subscription, error) {
	ts.logger.Info("Subscribe to terminal child processes")

	term, ok := ts.termManager.Get(terminalID)
	if !ok {
		errMsg := fmt.Sprintf("cannot find terminal with ID %s", terminalID)
		ts.logger.Error(errMsg)
		return nil, fmt.Errorf(errMsg)
	}

	sub, err := ts.saveNewSubscriber(ctx, ts.terminalChildProcessesSubscribers, terminalID)
	if err != nil {
		ts.logger.Errorw("Failed to create a terminal child processes subscription",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	if err := sub.subscriber.Notify(term.GetCachedChildProcesses()); err != nil {
		slogger.Errorw("Failed to send initial child processes",
			"subscriptionID", sub.subscriber.SubscriptionID(),
			"error", err,
		)
	}

	return sub.subscriber.subscription, nil
}

func (ts *TerminalService) Start(terminalID terminal.TerminalID, cols, rows uint16) (terminal.TerminalID, error) {
	ts.logger.Info("Starting terminal")

	term, ok := ts.termManager.Get(terminalID)

	// Terminal doesn't exist, we will create a new one.
	if !ok {
		ts.logger.Info("Creating a new terminal")

		newterm, err := ts.termManager.Add(workdir, cols, rows)
		if err != nil {
			errMsg := fmt.Sprintf("Failed to start new terminal: %v", err)
			ts.logger.Info(errMsg)
			return "", fmt.Errorf(errMsg)
		}

		ts.logger.Info("New terminal created")

		go func() {
			for {
				buf := make([]byte, 1024)
				read, err := term.Read(buf)

				if err != nil {
					ts.logger.Infof("Error reading from terminal %s - stopped reading", term.ID)
					return
				}

				data := string(buf[:read])

				for _, sub := range ts.getSubscribers(ts.terminalDataSubscribers, term.ID) {
					if err := sub.subscriber.Notify(data); err != nil {
						ts.logger.Errorw("Failed to send data notification",
							"subscriptionID", sub.subscriber.SubscriptionID(),
							"error", err,
						)
					}
				}
			}
		}()

		go func() {
			ticker := time.NewTicker(terminalChildProcessCheckInterval)
			pid := term.Pid()

			for range ticker.C {
				if term.IsDestroyed() {
					return
				}

				cps, err := process.GetChildProcesses(pid, ts.logger)
				if err != nil {
					ts.logger.Errorw("failed to get child processes for terminal",
						"terminalID", term.ID,
						"pid", pid,
						"error", err,
					)
					return
				}

				changed := !reflect.DeepEqual(cps, term.GetCachedChildProcesses())
				if !changed {
					continue
				}

				term.SetCachedChildProcesses(cps)
				for _, sub := range ts.getSubscribers(ts.terminalChildProcessesSubscribers, term.ID) {
					if err := sub.subscriber.Notify(cps); err != nil {
						ts.logger.Errorw("Failed to send child processes notification",
							"subscriptionID", sub.subscriber.SubscriptionID(),
							"error", err,
						)
					}
				}
			}
		}()

		ts.logger.Info("Started terminal output data watcher")

		term = newterm
	}

	return term.ID, nil
}

func (ts *TerminalService) Data(terminalID terminal.TerminalID, data string) error {
	term, ok := ts.termManager.Get(terminalID)

	if !ok {
		errMsg := fmt.Sprintf("cannot find terminal with ID %s", terminalID)
		ts.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	_, err := term.Write([]byte(data))

	if err != nil {
		errMsg := fmt.Sprintf("cannot write data %s to terminal with ID %s: %+v", data, terminalID, err)
		ts.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	return nil
}

func (ts *TerminalService) Resize(terminalID terminal.TerminalID, cols, rows uint16) error {
	ts.logger.Info("Resize terminal")

	term, ok := ts.termManager.Get(terminalID)

	if !ok {
		errMsg := fmt.Sprintf("cannot find terminal with ID %s", terminalID)
		ts.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	err := term.Resize(cols, rows)

	if err != nil {
		errMsg := fmt.Sprintf("cannot resize terminal with ID %s: %+v", terminalID, err)
		ts.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	return nil
}

func (ts *TerminalService) Destroy(terminalID terminal.TerminalID) error {
	ts.logger.Info("Destroy")

	ts.termManager.Remove(terminalID)

	for _, s := range ts.getSubscribers(ts.terminalDataSubscribers, terminalID) {
		ts.removeSubscriber(ts.terminalDataSubscribers, s.subscriber.SubscriptionID())
	}

	for _, s := range ts.getSubscribers(ts.terminalChildProcessesSubscribers, terminalID) {
		ts.removeSubscriber(ts.terminalChildProcessesSubscribers, s.subscriber.SubscriptionID())
	}

	return nil
}

func (ts *TerminalService) KillProcess(pid int) error {
	ts.logger.Info("Kill process")

	err := process.KillProcess(pid)

	if err != nil {
		errMsg := fmt.Sprintf("cannot kill process %d: %v", pid, err)
		ts.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	return nil
}

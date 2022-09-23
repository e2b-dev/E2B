package service

import (
	"context"
	"fmt"
	"io"
	"reflect"
	"sync"
	"time"

	"github.com/devbookhq/devbookd/internal/env"
	"github.com/devbookhq/devbookd/internal/process"
	"github.com/devbookhq/devbookd/internal/terminal"
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
	logger *zap.SugaredLogger
	env    *env.Env

	termManager *terminal.TerminalManager

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
		err, ok := <-sub.subscription.Err()
		if !ok {
			return
		}

		if err != nil {
			ts.logger.Errorw("Terminal subscription error",
				"subscriptionID", sub.SubscriptionID(),
				"error", err,
			)
			ts.Destroy(terminalID, sub.SubscriptionID())
		}
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

func NewTerminalService(logger *zap.SugaredLogger, env *env.Env) *TerminalService {
	return &TerminalService{
		logger:                            logger,
		env:                               env,
		terminalChildProcessesSubscribers: make(map[rpc.ID]*TerminalSubscriber),
		terminalDataSubscribers:           make(map[rpc.ID]*TerminalSubscriber),
		termManager:                       terminal.NewTerminalManager(),
	}
}

// Subscription
func (ts *TerminalService) OnData(ctx context.Context, terminalID terminal.TerminalID) (*rpc.Subscription, error) {
	ts.logger.Infow("Subscribe to terminal data",
		"terminalID", terminalID,
	)

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
	ts.logger.Infow("Subscribe to terminal child processes",
		"terminalID", terminalID,
	)

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
		ts.logger.Errorw("Failed to send initial child processes",
			"subscriptionID", sub.subscriber.SubscriptionID(),
			"error", err,
		)
	}

	return sub.subscriber.subscription, nil
}

func (ts *TerminalService) Start(terminalID terminal.TerminalID, cols, rows uint16) (terminal.TerminalID, error) {
	ts.logger.Infow("Start terminal",
		"terminalID", terminalID,
	)

	term, ok := ts.termManager.Get(terminalID)

	if ok {
		ts.logger.Infow("Terminal with this ID already exists", "terminalID", terminalID)
	} else {
		// Terminal doesn't exist, we will create a new one.
		ts.logger.Infow("Terminal with ID doesn't exist yet. Creating a new terminal",
			"requestedTerminalID", terminalID,
		)

		newTerm, err := ts.termManager.Add(
			ts.logger,
			terminalID,
			ts.env.Shell(),
			ts.env.Workdir(),
			cols,
			rows,
		)
		if err != nil {
			errMsg := fmt.Sprintf("Failed to start new terminal: %v", err)
			ts.logger.Info(errMsg)
			return "", fmt.Errorf(errMsg)
		}

		ts.logger.Infow("New terminal created",
			"terminalID", newTerm.ID,
		)

		go func() {
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
						ts.logger.Infow("Error reading from terminal",
							"terminalID", newTerm.ID,
							"error", err,
						)
						// TODO: Destroy only if there aren't other subscribers using it.
						//ts.Destroy(newTerm.ID)
						return
					}
				}

				if read > 0 {
					data := string(buf[:read])

					for _, sub := range ts.getSubscribers(ts.terminalDataSubscribers, newTerm.ID) {
						if err := sub.subscriber.Notify(data); err != nil {
							ts.logger.Errorw("Failed to send data notification",
								"subscriptionID", sub.subscriber.SubscriptionID(),
								"error", err,
							)
						}
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

				cps, err := process.GetChildProcesses(pid, ts.logger)
				if err != nil {
					ts.logger.Errorw("failed to get child processes for terminal",
						"terminalID", newTerm.ID,
						"pid", pid,
						"error", err,
					)
					return
				}

				changed := !reflect.DeepEqual(cps, newTerm.GetCachedChildProcesses())
				if !changed {
					continue
				}

				newTerm.SetCachedChildProcesses(cps)
				for _, sub := range ts.getSubscribers(ts.terminalChildProcessesSubscribers, newTerm.ID) {
					if err := sub.subscriber.Notify(cps); err != nil {
						ts.logger.Errorw("Failed to send child processes notification",
							"subscriptionID", sub.subscriber.SubscriptionID(),
							"error", err,
						)
					}
				}
			}
		}()

		ts.logger.Infow("Started terminal output data watcher", "terminalID", newTerm.ID)
		return newTerm.ID, nil
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

	if _, err := term.Write([]byte(data)); err != nil {
		errMsg := fmt.Sprintf("cannot write data %s to terminal with ID %s: %+v", data, terminalID, err)
		ts.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	return nil
}

func (ts *TerminalService) Resize(terminalID terminal.TerminalID, cols, rows uint16) error {
	term, ok := ts.termManager.Get(terminalID)

	if !ok {
		errMsg := fmt.Sprintf("cannot find terminal with ID %s", terminalID)
		ts.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	if err := term.Resize(cols, rows); err != nil {
		errMsg := fmt.Sprintf("cannot resize terminal with ID %s: %+v", terminalID, err)
		ts.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	return nil
}

func (ts *TerminalService) Destroy(terminalID terminal.TerminalID, subID rpc.ID) {
	ts.logger.Infow("Remove subscriber for terminal",
		"terminalID", terminalID,
		"subscriptionID", subID,
	)

	dataSubs := ts.getSubscribers(ts.terminalDataSubscribers, terminalID)
	dataSubsCount := len(dataSubs)
	for _, s := range dataSubs {
		if s.subscriber.SubscriptionID() == subID {
			ts.removeSubscriber(ts.terminalDataSubscribers, s.subscriber.SubscriptionID())
			dataSubsCount -= 1
		}
	}

	childProcSubs := ts.getSubscribers(ts.terminalChildProcessesSubscribers, terminalID)
	childProcSubsCount := len(childProcSubs)
	for _, s := range childProcSubs {
		if s.subscriber.SubscriptionID() == subID {
			ts.removeSubscriber(ts.terminalChildProcessesSubscribers, s.subscriber.SubscriptionID())
			childProcSubsCount -= 1
		}
	}

	ts.logger.Debugw("Sub count",
		"terminalID", terminalID,
		"dataSubsCountForTerminalID", dataSubsCount,
		"childProcSubsCountForTerminalID", childProcSubsCount,
		"dataSubCountTotal", len(ts.terminalDataSubscribers),
		"childProcSubsCountTotal", len(ts.terminalChildProcessesSubscribers),
	)

	// Remove terminal only if there aren't any subscriptions left.
	if dataSubsCount == 0 && childProcSubsCount == 0 {
		ts.logger.Infow("Removing terminal, no subscribers left",
			"terminalID", terminalID,
		)
		ts.termManager.Remove(terminalID)
	}
}

func (ts *TerminalService) KillProcess(pid int) error {
	if err := process.KillProcess(pid); err != nil {
		errMsg := fmt.Sprintf("cannot kill process %d: %v", pid, err)
		ts.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	return nil
}

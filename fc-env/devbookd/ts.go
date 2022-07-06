package main

import (
	"context"
	"fmt"
	"sync"

	"github.com/devbookhq/orchestration-services/fc-env/devbookd/pkg/terminal"
	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"
)

const ServiceName = "terminal"

type TerminalDataSubscriber struct {
	subscriber *subscriber
	terminalID terminal.TerminalID
}

type TerminalService struct {
	termManager *terminal.TerminalManager

	logger *zap.SugaredLogger

	subscribersLock         sync.RWMutex
	terminalDataSubscribers map[rpc.ID]*TerminalDataSubscriber
}

func (ts *TerminalService) saveNewSubscriber(ctx context.Context, subs map[rpc.ID]*TerminalDataSubscriber, terminalID terminal.TerminalID) (*TerminalDataSubscriber, error) {
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

	wrappedSub := &TerminalDataSubscriber{
		terminalID: terminalID,
		subscriber: sub,
	}

	ts.subscribersLock.Lock()
	defer ts.subscribersLock.Unlock()

	subs[sub.SubscriptionID()] = wrappedSub
	return wrappedSub, nil
}

func (ts *TerminalService) removeSubscriber(subs map[rpc.ID]*TerminalDataSubscriber, subscriberID rpc.ID) {
	ts.subscribersLock.Lock()
	defer ts.subscribersLock.Unlock()

	delete(subs, subscriberID)
}

func (ts *TerminalService) getSubscribers(subs map[rpc.ID]*TerminalDataSubscriber, terminalID terminal.TerminalID) []*TerminalDataSubscriber {
	terminalSubscribers := []*TerminalDataSubscriber{}

	ts.subscribersLock.RLock()
	defer ts.subscribersLock.RUnlock()

	for _, s := range ts.terminalDataSubscribers {
		if s.terminalID == terminalID {
			terminalSubscribers = append(terminalSubscribers, s)
		}
	}

	return terminalSubscribers
}

func NewTerminalService(logger *zap.SugaredLogger) *TerminalService {
	ts := &TerminalService{
		terminalDataSubscribers: make(map[rpc.ID]*TerminalDataSubscriber),
		logger:                  logger,
		termManager:             terminal.NewTerminalManager(),
	}

	return ts
}

// Subscription
func (ts *TerminalService) OnData(ctx context.Context, terminalID terminal.TerminalID) (*rpc.Subscription, error) {
	ts.logger.Info("Subscribe to terminal data")

	_, ok := ts.termManager.Get(terminalID)

	if !ok {
		errMsg := fmt.Sprint("Cannot find terminal with ID %s", terminalID)
		ts.logger.Error(errMsg)
		return nil, fmt.Errorf(errMsg)
	}

	sub, err := ts.saveNewSubscriber(ctx, ts.terminalDataSubscribers, terminalID)
	if err != nil {
		ts.logger.Errorw("Failed to create a state subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
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

		ts.logger.Info("Started terminal output data watcher")

		term = newterm
	}

	return term.ID, nil
}

func (ts *TerminalService) Data(terminalID terminal.TerminalID, data string) error {
	term, ok := ts.termManager.Get(terminalID)

	if !ok {
		errMsg := fmt.Sprint("Cannot find terminal with ID %s", terminalID)
		ts.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	_, err := term.Write([]byte(data))

	if err != nil {
		errMsg := fmt.Sprint("Cannot write data %s to terminal with ID %s", data, terminalID)
		ts.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	return nil
}

func (ts *TerminalService) Resize(terminalID terminal.TerminalID, cols, rows uint16) error {
	ts.logger.Info("Resize terminal")

	term, ok := ts.termManager.Get(terminalID)

	if !ok {
		errMsg := fmt.Sprint("Cannot find terminal with ID %s", terminalID)
		ts.logger.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	err := term.Resize(cols, rows)

	if err != nil {
		errMsg := fmt.Sprint("Cannot resize terminal with ID %s", terminalID)
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

	return nil
}

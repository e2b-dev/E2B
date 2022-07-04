package terminal

import (
	"context"
	"fmt"

	"github.com/devbookhq/orchestration-services/fc-env/devbookd/internal/subscriber"
	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"
)

const ServiceName = "terminal"

type TerminalDataSubscriber struct {
	*subscriber.Subscriber
	terminalID TerminalID
}

type TerminalService struct {
	terminals *TerminalManager

	logger *zap.SugaredLogger

	terminalDataSubscribers map[rpc.ID]*TerminalDataSubscriber
}

func (ts *TerminalService) saveNewSubscriber(ctx context.Context, subs map[rpc.ID]*TerminalDataSubscriber, terminalID TerminalID) (*TerminalDataSubscriber, error) {
	sub, err := subscriber.NewSubscriber(ctx)
	if err != nil {
		return nil, err
	}

	// Watch for subscription errors.
	go func() {
		err := <-sub.Subscription.Err()
		ts.logger.Errorw("Subscribtion error",
			"subscriptionID", sub.SubscriptionID(),
			"error", err,
		)
		delete(subs, sub.SubscriptionID())
	}()

	wrappedSub := &TerminalDataSubscriber{
		terminalID: terminalID,
		Subscriber: sub,
	}

	subs[sub.SubscriptionID()] = wrappedSub
	return wrappedSub, nil
}

func NewTerminalService(logger *zap.SugaredLogger) *TerminalService {
	ts := &TerminalService{
		terminalDataSubscribers: make(map[rpc.ID]*TerminalDataSubscriber),
		terminals:               &TerminalManager{},
		logger:                  logger,
	}

	return ts
}

func (ts *TerminalService) OnData(ctx context.Context, terminalID TerminalID) (*rpc.Subscription, error) {
	ts.logger.Info("Subscribe to terminal data")

	_, ok := ts.terminals.Get(&terminalID)

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

	return sub.Subscription, nil
}

func (ts *TerminalService) Start(terminalID *TerminalID) TerminalID {
	ts.logger.Info("Starting terminal")

	term, ok := ts.terminals.Get(terminalID)

	// Terminal doesn't exist, we will create a new one.
	if !ok {
		newterm, err := ts.terminals.Add()
		if err != nil {
			ts.logger.Info(fmt.Sprintf("Failed to `TermStart`, error from templ.NewTerminal(): %v", err))
		}

		go term.Watch(func(data string) {
			for _, sub := range ts.terminalDataSubscribers {
				if sub.terminalID != *terminalID {
					continue
				}

				if err := sub.Subscriber.Notify(data); err != nil {
					ts.logger.Errorw("Failed to send on data notification",
						"subscriptionID", sub.SubscriptionID(),
						"error", err,
					)
				}
			}
		}, ts.logger)

		term = newterm
	}

	return term.ID
}

func (ts *TerminalService) Data(terminalID TerminalID, data string) error {
	ts.logger.Info("Write data to terminal")

	term, ok := ts.terminals.Get(&terminalID)

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

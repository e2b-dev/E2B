package main

import (
	"context"

	"github.com/ethereum/go-ethereum/rpc"
)

type subscriber struct {
  notifier      *rpc.Notifier
  subscription  *rpc.Subscription
}

func newSubscriber(ctx context.Context) (*subscriber, error) {
	notifier, support := rpc.NotifierFromContext(ctx)
	if !support {
		return nil, rpc.ErrNotificationsUnsupported
	}
	subscription := notifier.CreateSubscription()
	return &subscriber{notifier, subscription}, nil
}

func (s *subscriber) SubscriptionID() rpc.ID {
  return s.subscription.ID
}

func (s *subscriber) Notify(data interface{}) error {
  return s.notifier.Notify(s.subscription.ID, data)
}

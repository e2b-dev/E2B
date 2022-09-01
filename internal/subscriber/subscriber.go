package subscriber

import (
	"context"

	"github.com/ethereum/go-ethereum/rpc"
)

type Subscriber struct {
	Notifier     *rpc.Notifier
	Subscription *rpc.Subscription
}

func NewSubscriber(ctx context.Context) (*Subscriber, error) {
	notifier, support := rpc.NotifierFromContext(ctx)
	if !support {
		return nil, rpc.ErrNotificationsUnsupported
	}
	subscription := notifier.CreateSubscription()
	return &Subscriber{notifier, subscription}, nil
}

func (s *Subscriber) SubscriptionID() rpc.ID {
	return s.Subscription.ID
}

func (s *Subscriber) Notify(data interface{}) error {
	return s.Notifier.Notify(s.Subscription.ID, data)
}

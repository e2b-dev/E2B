package subscriber

import (
	"context"
	"fmt"

	"github.com/ethereum/go-ethereum/rpc"
)

type Subscriber struct {
	Notifier     *rpc.Notifier
	Subscription *rpc.Subscription
	Topic        string
}

func New(ctx context.Context, topic string) (*Subscriber, error) {
	notifier, support := rpc.NotifierFromContext(ctx)

	if !support {
		return nil, fmt.Errorf("error creating data subscription from context %+v, %+v", ctx, rpc.ErrNotificationsUnsupported)
	}

	return &Subscriber{
		Topic:        topic,
		Notifier:     notifier,
		Subscription: notifier.CreateSubscription(),
	}, nil
}

func (s *Subscriber) Notify(data interface{}) error {
	return s.Notifier.Notify(s.Subscription.ID, data)
}

package subscriber

import (
	"context"
	"fmt"

	"github.com/ethereum/go-ethereum/rpc"
)

type ID = string

type Subscriber struct {
	Notifier     *rpc.Notifier
	Subscription *rpc.Subscription
	ID           ID
}

func New(ctx context.Context, id ID) (*Subscriber, error) {
	notifier, support := rpc.NotifierFromContext(ctx)

	if !support {
		return nil, fmt.Errorf("error creating data subscription from context %+v, %+v", ctx, rpc.ErrNotificationsUnsupported)
	}

	return &Subscriber{
		ID:           id,
		Notifier:     notifier,
		Subscription: notifier.CreateSubscription(),
	}, nil
}

func (s *Subscriber) Notify(data interface{}) error {
	return s.Notifier.Notify(s.Subscription.ID, data)
}

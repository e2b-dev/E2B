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

	subscription := notifier.CreateSubscription()

	return &Subscriber{
		Topic:        topic,
		Notifier:     notifier,
		Subscription: subscription,
	}, nil
}

func (s *Subscriber) Notify(data interface{}) (err error) {
	defer func() {
		if recoverErr := recover(); recoverErr != nil {
			// TODO: Log the error somewhere
			err = fmt.Errorf("recovered from subscriber notify panic: %+v", recoverErr)
		}
	}()

	return s.Notifier.Notify(s.Subscription.ID, data)
}

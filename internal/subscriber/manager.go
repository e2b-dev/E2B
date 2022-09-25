package subscriber

import (
	"context"
	"fmt"

	"github.com/devbookhq/devbookd/internal/smap"
	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"
)

type Manager struct {
	subs *smap.Map[rpc.ID, Subscriber]
}

func NewManager() *Manager {
	return &Manager{
		subs: smap.New[rpc.ID, Subscriber](),
	}
}

func (m *Manager) Notify(id ID, data interface{}) error {
	return m.subs.Iterate(func(_ rpc.ID, sub *Subscriber) error {
		if sub.ID == id {
			err := sub.Notify(data)
			if err != nil {
				return fmt.Errorf("error sending data notification for subID %s, %+v", sub.Subscription.ID, err)
			}
		}
		return nil
	})
}

func (m *Manager) HasSubscribers(id ID) bool {
	subs, err := m.GetByID(id)

	if err != nil {
		return false
	}

	return len(subs) > 0
}

func (m *Manager) GetByID(id ID) ([]*Subscriber, error) {
	var subscribers []*Subscriber

	err := m.subs.Iterate(func(_ rpc.ID, sub *Subscriber) error {
		if sub.ID == id {
			subscribers = append(subscribers, sub)
		}
		return nil
	})

	return subscribers, err
}

func (m *Manager) Add(ctx context.Context, id ID, logger *zap.SugaredLogger) (*Subscriber, chan bool, error) {
	lastUnsubscribed := make(chan bool, 1)

	sub, err := New(ctx, id)
	if err != nil {
		return nil, lastUnsubscribed, err
	}

	m.subs.Insert(sub.Subscription.ID, sub)

	go func() {
		err := <-sub.Subscription.Err()

		if err != nil {
			logger.Errorw("Subscription error",
				"subID", sub.Subscription.ID,
				"error", err,
			)
		}

		m.subs.Remove(sub.Subscription.ID)

		logger.Infow("Unsubscribed",
			"subID",
			sub.Subscription.ID,
		)

		if m.subs.Size() == 0 {
			lastUnsubscribed <- true
		}
	}()

	return sub, lastUnsubscribed, nil
}

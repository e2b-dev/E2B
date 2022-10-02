package subscriber

import (
	"context"
	"fmt"

	"github.com/devbookhq/devbookd/internal/smap"
	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"
)

type Manager struct {
	subs   *smap.Map[rpc.ID, Subscriber]
	label  string
	logger *zap.SugaredLogger
}

func NewManager(label string, logger *zap.SugaredLogger) *Manager {
	return &Manager{
		label:  label,
		logger: logger,
		subs:   smap.New[rpc.ID, Subscriber](),
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
	subs := m.GetByID(id)

	m.logger.Debugw("Remaining subscribers",
		"subscription", m.label,
		"ID", id,
		"count", len(subs),
	)

	return len(subs) > 0
}

func (m *Manager) GetByID(id ID) []*Subscriber {
	var subscribers []*Subscriber

	m.subs.Iterate(func(_ rpc.ID, sub *Subscriber) error {
		if sub.ID == id {
			subscribers = append(subscribers, sub)
		}
		return nil
	})

	return subscribers
}

func (m *Manager) Add(ctx context.Context, id ID) (*Subscriber, chan bool, error) {
	lastUnsubscribed := make(chan bool, 1)

	sub, err := New(ctx, id)
	if err != nil {
		return nil, lastUnsubscribed, err
	}

	m.subs.Insert(sub.Subscription.ID, sub)

	go func() {
		for err := range sub.Subscription.Err() {
			if err != nil {
				m.logger.Errorw("Subscription error",
					"subID", sub.Subscription.ID,
					"subscription", m.label,
					"error", err,
				)
			}
		}

		m.subs.Remove(sub.Subscription.ID)

		m.logger.Infow("Unsubscribed",
			"subscription", m.label,
			"subID", sub.Subscription.ID,
		)

		if !m.HasSubscribers(sub.ID) {
			lastUnsubscribed <- true
			close(lastUnsubscribed)
		}
	}()

	return sub, lastUnsubscribed, nil
}

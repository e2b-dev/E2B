package subscriber

import (
	"context"
	"fmt"

	"github.com/devbookhq/devbook-api/packages/devbookd/internal/smap"
	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"
)

type Manager struct {
	logger *zap.SugaredLogger
	label  string
	subs   *smap.Map[rpc.ID, Subscriber]
}

func NewManager(label string, logger *zap.SugaredLogger) *Manager {
	return &Manager{
		logger: logger,
		label:  label,
		subs:   smap.New[rpc.ID, Subscriber](),
	}
}

func (m *Manager) Notify(topic string, data interface{}) error {
	return m.subs.Iterate(func(_ rpc.ID, sub *Subscriber) error {
		if sub.Topic == topic {
			err := sub.Notify(data)
			if err != nil {
				return fmt.Errorf("error sending data notification for subID %s, %+v", sub.Subscription.ID, err)
			}
		}
		return nil
	})
}

// Has returns true if there's at least one subscriber associated with the topic.
func (m *Manager) Has(topic string) bool {
	return len(m.Get(topic)) > 0
}

// Get returns all subscribers associated with the topic.
func (m *Manager) Get(topic string) []*Subscriber {
	var subscribers []*Subscriber

	m.subs.Iterate(func(_ rpc.ID, sub *Subscriber) error {
		if sub.Topic == topic {
			subscribers = append(subscribers, sub)
		}
		return nil
	})

	return subscribers
}

// Create creates a new subscriber for a given topic.
// It returns the newly created subsriber and a blocking channel indicating whether there are any subscribers left for the passed topic.
func (m *Manager) Create(ctx context.Context, topic string) (*Subscriber, chan bool, error) {
	allUnsubscribed := make(chan bool, 1)

	sub, err := New(ctx, topic)
	if err != nil {
		return nil, allUnsubscribed, err
	}

	m.subs.Insert(sub.Subscription.ID, sub)

	go func() {
		// Keep iterating over the error channel until it's closed.
		for err := range sub.Subscription.Err() {
			if err != nil {
				m.logger.Errorw("Subscription error",
					"subID", sub.Subscription.ID,
					"subscription", m.label,
					"error", err,
				)
			}
		}

		// Remove a subscriber once the error channel closes.
		m.subs.Remove(sub.Subscription.ID)

		m.logger.Infow("Unsubscribed",
			"subscription", m.label,
			"topic", topic,
			"subID", sub.Subscription.ID,
		)

		if !m.Has(sub.Topic) {
			allUnsubscribed <- true
		}
	}()

	return sub, allUnsubscribed, nil
}

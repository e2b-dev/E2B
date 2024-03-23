package subscriber

import (
	"context"
	"fmt"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/e2b-dev/infra/packages/shared/pkg/smap"
)

type Manager struct {
	logger *zap.SugaredLogger
	subs   *smap.Map[*Subscriber]
	label  string
}

func NewManager(label string, logger *zap.SugaredLogger) *Manager {
	return &Manager{
		logger: logger,
		label:  label,
		subs:   smap.New[*Subscriber](),
	}
}

func (m *Manager) Notify(topic string, data interface{}) error {
	for _, sub := range m.subs.Items() {
		if sub.Topic == topic {
			err := sub.Notify(data)
			if err != nil {
				return fmt.Errorf("error sending data notification for subID %s, %w", sub.Subscription.ID, err)
			}
		}
	}

	return nil
}

// Has returns true if there's at least one subscriber associated with the topic.
func (m *Manager) Has(topic string) bool {
	return len(m.Get(topic)) > 0
}

// Get returns all subscribers associated with the topic.
func (m *Manager) Get(topic string) []*Subscriber {
	var subscribers []*Subscriber

	for _, sub := range m.subs.Items() {
		if sub.Topic == topic {
			subscribers = append(subscribers, sub)
		}
	}

	return subscribers
}

// Create a new subscriber for a given topic.
// It returns the newly created subscriber and a blocking channel indicating whether there are any subscribers left for the passed topic.
func (m *Manager) Create(ctx context.Context, topic string) (*Subscriber, chan struct{}, error) {
	allUnsubscribed := make(chan struct{})

	sub, err := New(ctx, topic)
	if err != nil {
		return nil, allUnsubscribed, err
	}

	m.subs.Insert(string(sub.Subscription.ID), sub)

	go func() {
		// Keep iterating over the error channel until it's closed.
		for err := range sub.Subscription.Err() {
			if err != nil {
				if websocket.IsCloseError(err, websocket.CloseAbnormalClosure) {
					m.logger.Warnw("Websocket abnormal closure",
						"subID", sub.Subscription.ID,
						"subscription", m.label,
						"error", err,
					)
				} else {
					m.logger.Errorw("Subscription error",
						"subID", sub.Subscription.ID,
						"subscription", m.label,
						"error", err,
					)
				}
			}
		}

		// Remove a subscriber once the error channel closes.
		m.subs.Remove(string(sub.Subscription.ID))

		m.logger.Debugw("Unsubscribed",
			"subscription", m.label,
			"topic", topic,
			"subID", sub.Subscription.ID,
		)

		// if !m.Has(sub.Topic) {
		// 	close(allUnsubscribed)
		// }
	}()

	return sub, allUnsubscribed, nil
}

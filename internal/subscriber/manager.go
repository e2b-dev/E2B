package subscriber

import (
	"context"
	"fmt"
	"sync"

	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"
)

type Manager struct {
	mu   sync.RWMutex
	subs map[rpc.ID]*Subscriber
}

func NewManager() *Manager {
	return &Manager{
		subs: make(map[rpc.ID]*Subscriber),
	}
}

func (m *Manager) Notify(id ID, data interface{}) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, sub := range m.subs {
		if sub.ID == id {
			err := sub.Notify(data)
			if err != nil {
				return fmt.Errorf("error sending data notification for subID %s, %+v", sub.Subscription.ID, err)
			}
		}
	}

	return nil
}

func (m *Manager) Remove(subID rpc.ID) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.subs, subID)
}

func (m *Manager) Add(ctx context.Context, id ID, logger *zap.SugaredLogger) (*Subscriber, error) {
	sub, err := New(ctx, id)
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	m.subs[sub.Subscription.ID] = sub
	m.mu.Unlock()

	go func() {
		err := <-sub.Subscription.Err()

		if err != nil {
			logger.Errorw("Subscription error",
				"subID", sub.Subscription.ID,
				"error", err,
			)
		}

		m.Remove(sub.Subscription.ID)

		logger.Infow("Unsubscribed",
			"subID",
			sub.Subscription.ID,
		)
	}()

	return sub, nil
}

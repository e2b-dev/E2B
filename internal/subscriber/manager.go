package subscriber

import (
	"context"
	"fmt"
	"sync"

	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"
)

type Manager struct {
	lock sync.RWMutex
	subs map[rpc.ID]*Subscriber
}

func NewManager() *Manager {
	return &Manager{
		subs: make(map[rpc.ID]*Subscriber),
	}
}

func (m *Manager) GetBySubID(subID rpc.ID) (*Subscriber, error) {
	m.lock.RLock()
	defer m.lock.RUnlock()

	sub := m.subs[subID]

	if sub == nil {
		return nil, fmt.Errorf("error retrieving subscriber with subID %s", subID)
	}

	return sub, nil
}

func (m *Manager) GetByID(id ID) (*Subscriber, error) {
	m.lock.RLock()
	defer m.lock.RUnlock()

	for _, sub := range m.subs {
		if sub.ID == id {
			return sub, nil
		}
	}

	return nil, fmt.Errorf("error retrieving subscriber with ID %s", id)
}

func (m *Manager) List() map[rpc.ID]*Subscriber {
	m.lock.RLock()
	defer m.lock.RUnlock()

	list := make(map[rpc.ID]*Subscriber, len(m.subs))

	for k, v := range m.subs {
		list[k] = v
	}

	return list
}

func (m *Manager) Notify(id ID, data interface{}) error {
	m.lock.RLock()
	defer m.lock.RUnlock()

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

func (m *Manager) RemoveBySubID(subID rpc.ID) {
	m.lock.Lock()
	defer m.lock.Unlock()

	delete(m.subs, subID)
}

func (m *Manager) RemoveAll() {
	m.lock.Lock()
	defer m.lock.Unlock()

	m.subs = make(map[rpc.ID]*Subscriber)
}

func (m *Manager) Add(ctx context.Context, id ID, logger *zap.SugaredLogger) (*Subscriber, error) {

	sub, err := New(ctx, id)
	if err != nil {
		return nil, err
	}

	logger.Info("Created subscriber", sub.Subscription.ID, m.subs)

	m.lock.Lock()
	m.subs[sub.Subscription.ID] = sub
	m.lock.Unlock()

	logger.Info("Subscriber added to map")

	go func() {
		err := <-sub.Subscription.Err()

		if err != nil {
			logger.Errorw("Subscription error",
				"subID", sub.Subscription.ID,
				"error", err,
			)
		}

		m.RemoveBySubID(sub.Subscription.ID)
	}()

	return sub, nil
}

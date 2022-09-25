package smap

import (
	"sync"
)

type Map[K comparable, V any] struct {
	mu sync.RWMutex
	m  map[K]*V
}

func New[K comparable, V any]() *Map[K, V] {
	return &Map[K, V]{
		m: make(map[K]*V),
	}
}

func (m *Map[K, V]) Remove(key K) *V {
	value, ok := m.Get(key)

	if !ok {
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.m, key)

	return value
}

func (m *Map[K, V]) Size() int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return len(m.m)
}

func (m *Map[K, V]) Get(key K) (*V, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	term, ok := m.m[key]
	return term, ok
}

func (m *Map[K, V]) Insert(key K, value *V) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.m[key] = value
}

func (m *Map[K, V]) Iterate(apply func(key K, value *V) error) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for key, value := range m.m {
		err := apply(key, value)
		if err != nil {
			return err
		}
	}

	return nil
}

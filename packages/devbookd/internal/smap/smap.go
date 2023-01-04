package smap

import (
	"sync"
)

type Map[V any] struct {
	mu sync.Mutex
	m  map[string]V
}

func New[V any]() *Map[V] {
	return &Map[V]{
		m: make(map[string]V),
	}
}

func (m *Map[V]) Remove(key string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.m, key)
}

func (m *Map[V]) Get(key string) (V, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	term, ok := m.m[key]
	return term, ok
}

func (m *Map[V]) Insert(key string, value V) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.m[key] = value
}

func (m *Map[V]) Items() map[string]V {
	m.mu.Lock()
	defer m.mu.Unlock()

	items := make(map[string]V)
	for k, v := range m.m {
		items[k] = v
	}

	return items
}

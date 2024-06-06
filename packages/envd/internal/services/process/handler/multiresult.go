package handler

import "sync"

type multiResult[T any] struct {
	channels []chan T

	mu sync.RWMutex
}

func (m *multiResult[T]) Set(t T) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, ch := range m.channels {
		ch <- t
	}
}

func (m *multiResult[T]) Subscribe() (chan T, func()) {
	ch := make(chan T)

	m.mu.Lock()
	defer m.mu.Unlock()

	m.channels = append(m.channels, ch)

	return ch, func() {
		m.unsubscribe(ch)
	}
}

func (m *multiResult[T]) unsubscribe(ch chan T) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i, c := range m.channels {
		if c == ch {
			m.channels = append(m.channels[:i], m.channels[i+1:]...)

			break
		}
	}
}

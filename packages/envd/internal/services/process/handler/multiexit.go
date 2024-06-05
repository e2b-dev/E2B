package handler

import "sync"

type multiResult[T any] struct {
	mu       sync.RWMutex
	channels []chan T

	value *T
}

func (m *multiResult[T]) Set(t T) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.value != nil {
		return
	}

	for _, ch := range m.channels {
		ch <- t
	}
}

func (m *multiResult[T]) Subscribe() chan T {
	ch := make(chan T)

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.value != nil {
		go func() {
			ch <- *m.value
		}()

		return ch
	}

	m.channels = append(m.channels, ch)
	return ch
}

func (m *multiResult[T]) Unsubscribe(ch chan T) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i, c := range m.channels {
		if c == ch {
			m.channels = append(m.channels[:i], m.channels[i+1:]...)
			break
		}
	}
}

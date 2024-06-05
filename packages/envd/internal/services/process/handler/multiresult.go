package handler

import "sync"

type multiResult[T any] struct {
	value    *T
	channels []chan T

	mu sync.RWMutex
}

func (m *multiResult[T]) Set(t T) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.value != nil {
		return
	} else {
		m.value = &t
	}

	for _, ch := range m.channels {
		ch <- t
	}
}

func (m *multiResult[T]) Subscribe() chan T {
	ch := make(chan T)

	m.mu.Lock()
	defer m.mu.Unlock()

	m.channels = append(m.channels, ch)

	if m.value != nil {
		go func() {
			ch <- *m.value
		}()
	}

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

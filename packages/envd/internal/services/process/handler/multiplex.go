package handler

import (
	"sync"
	"sync/atomic"
)

type MultiplexedChannel[T any] struct {
	Source   chan T
	channels []chan T
	mu       sync.RWMutex
	exited   atomic.Bool
}

func NewMultiplexedChannel[T any](buffer int) *MultiplexedChannel[T] {
	c := &MultiplexedChannel[T]{
		channels: nil,
		Source:   make(chan T, buffer),
	}

	go func() {
		for v := range c.Source {
			c.mu.RLock()

			for _, cons := range c.channels {
				cons <- v
			}

			c.mu.RUnlock()
		}

		c.exited.Store(true)

		for _, cons := range c.channels {
			close(cons)
		}
	}()

	return c
}

func (m *MultiplexedChannel[T]) Fork() (chan T, func()) {
	if m.exited.Load() {
		ch := make(chan T)
		close(ch)

		return ch, func() {}
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	consumer := make(chan T)

	m.channels = append(m.channels, consumer)

	return consumer, func() {
		m.remove(consumer)
	}
}

func (m *MultiplexedChannel[T]) remove(consumer chan T) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i, ch := range m.channels {
		if ch == consumer {
			m.channels = append(m.channels[:i], m.channels[i+1:]...)

			return
		}
	}
}

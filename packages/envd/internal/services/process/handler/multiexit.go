package handler

import "sync"

type multiExit struct {
	mu       sync.RWMutex
	channels []chan ProcessExit

	value *ProcessExit
}

func (m *multiExit) Set(t ProcessExit) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.value != nil {
		return
	}

	for _, ch := range m.channels {
		ch <- t
	}
}

func (m *multiExit) Subscribe() chan ProcessExit {
	ch := make(chan ProcessExit)

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

func (m *multiExit) Unsubscribe(ch chan ProcessExit) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i, c := range m.channels {
		if c == ch {
			m.channels = append(m.channels[:i], m.channels[i+1:]...)
			break
		}
	}
}

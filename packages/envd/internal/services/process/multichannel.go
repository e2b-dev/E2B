package process

import "sync"

type multiChannel[T processExit] struct {
	sync.RWMutex
	channels []chan T
}

func (mc *multiChannel[T]) Broadcast(t T) {
	mc.Lock()
	defer mc.Unlock()

	for _, ch := range mc.channels {
		ch <- t
	}
}

func (slice *multiChannel[T]) GetListener() chan T {
	ch := make(chan T)

	slice.Lock()
	defer slice.Unlock()

	slice.channels = append(slice.channels, ch)
	return ch
}

func (slice *multiChannel[T]) Remove(ch chan T) {
	slice.Lock()
	defer slice.Unlock()

	for i, c := range slice.channels {
		if c == ch {
			slice.channels = append(slice.channels[:i], slice.channels[i+1:]...)
			break
		}
	}
}

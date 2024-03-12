package utils

import "context"

type BlockingSemaphore struct {
	semaphore chan struct{}
}

func NewBlockingSemaphore(limit int) *BlockingSemaphore {
	return &BlockingSemaphore{
		semaphore: make(chan struct{}, limit),
	}
}

func (l *BlockingSemaphore) Acquire(ctx context.Context) error {
	select {
	case l.semaphore <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (l *BlockingSemaphore) Release() {
	<-l.semaphore
}

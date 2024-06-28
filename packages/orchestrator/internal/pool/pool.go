package pool

import (
	"context"
	"fmt"

	"golang.org/x/sync/semaphore"
)

type Pool[T any] struct {
	pool chan T
}

func New[T any](size int) *Pool[T] {
	return &Pool[T]{
		pool: make(chan T, size),
	}
}

func (p *Pool[T]) Get() T {
	return <-p.pool
}

func (p *Pool[T]) Put(item T) {
	p.pool <- item
}

func (p *Pool[T]) Populate(ctx context.Context, concurrency int64, fn func() (T, error)) error {
	sem := semaphore.NewWeighted(concurrency)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			err := sem.Acquire(ctx, 1)
			if err != nil {
				return fmt.Errorf("failed to acquire semaphore: %w", err)
			}

			item, err := fn()
			if err != nil {
				sem.Release(1)

				return err
			}

			p.Put(item)

			sem.Release(1)
		}
	}

}

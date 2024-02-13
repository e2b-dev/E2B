package driver

import (
	"sync"
)

type TaskStore[TaskHandler HandleInterface] struct {
	store map[string]TaskHandler
	mu    sync.RWMutex
}

func NewTaskStore[T HandleInterface]() TaskStore[T] {
	return TaskStore[T]{store: map[string]T{}}
}

func (ts *TaskStore[TaskHandler]) Set(id string, handle TaskHandler) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	ts.store[id] = handle
}

func (ts *TaskStore[TaskHandler]) Get(id string) (TaskHandler, bool) {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	t, ok := ts.store[id]

	return t, ok
}

func (ts *TaskStore[TaskHandler]) Delete(id string) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	delete(ts.store, id)
}

package internal

import (
	"sync"
)

type taskStore struct {
	store map[string]*taskHandle
	mu    sync.RWMutex
}

func newTaskStore() *taskStore {
	return &taskStore{store: map[string]*taskHandle{}}
}

func (ts *taskStore) Set(id string, handle *taskHandle) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	ts.store[id] = handle
}

func (ts *taskStore) Get(id string) (*taskHandle, bool) {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	t, ok := ts.store[id]
	return t, ok
}

func (ts *taskStore) Delete(id string) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	delete(ts.store, id)
}

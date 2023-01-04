package smap

import (
	"github.com/lrita/cmap"
)

type Map[K comparable, V any] struct {
	m *cmap.Map[K, V]
}

func New[K comparable, V any]() *Map[K, V] {
	return &Map[K, V]{
		m: &cmap.Map[K, V]{},
	}
}

func (m *Map[K, V]) Remove(key K) {
	m.m.Delete(key)
}

func (m *Map[K, V]) Get(key K) (*V, bool) {
	value, ok := m.m.Load(key)
	return &value, ok
}

func (m *Map[K, V]) Insert(key K, value *V) {
	m.m.Store(key, *value)
}

func (m *Map[K, V]) Iterate(apply func(key K, value *V) error) (err error) {
	m.m.Range(func(key K, value V) bool {
		if err == nil {
			err = apply(key, &value)
			return err == nil
		}
		return false
	})

	return err
}

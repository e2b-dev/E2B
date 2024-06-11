package handler

import (
	"fmt"
	"io"
	"sync"
)

// This is the capacity of pipe buffer on x86_64.
const DefaultChunkSize = 2 << 15 // 65KiB

type multiReader struct {
	exit    chan error
	writers []*io.PipeWriter
	mu      sync.RWMutex
}

func NewMultiReader(reader io.ReadCloser) *multiReader {
	m := &multiReader{
		exit: make(chan error, 1),
	}

	go m.start(reader)

	return m
}

func (m *multiReader) Wait() error {
	return <-m.exit
}

func (m *multiReader) start(reader io.ReadCloser) {
	buf := make([]byte, DefaultChunkSize)

	for {
		n, err := reader.Read(buf)
		fmt.Println("read", n, "bytes")
		if err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				m.write(buf[:n])
			}
			m.exit <- err

			break
		}

		m.write(buf[:n])
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, w := range m.writers {
		w.Close()
	}
}

func (m *multiReader) write(p []byte) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, w := range m.writers {
		n, err := w.Write(p)
		if err != nil {
			w.CloseWithError(err)

			continue
		}

		if n < len(p) {
			w.CloseWithError(io.ErrShortWrite)

			continue
		}
	}
}

// Add appends a writer to the list of writers this multiwriter writes to.
func (m *multiReader) Add() (*io.PipeReader, func()) {
	m.mu.Lock()
	defer m.mu.Unlock()

	r, w := io.Pipe()

	m.writers = append(m.writers, w)

	return r, func() {
		w.Close()
		m.remove(w)
	}
}

// Remove will remove a previously added writer from the list of writers.
func (m *multiReader) remove(w *io.PipeWriter) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i, c := range m.writers {
		if c == w {
			m.writers = append(m.writers[:i], m.writers[i+1:]...)

			break
		}
	}
}

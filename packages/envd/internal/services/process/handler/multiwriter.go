package handler

import (
	"io"
	"log"
	"sync"
)

const DefaultChunkSize = 32 * 1024 // 32KB

type multiWriterCloser struct {
	exit    chan struct{}
	writers []io.WriteCloser
	mu      sync.RWMutex
}

func NewMultiWriterCloser(reader io.Reader, writers ...io.WriteCloser) *multiWriterCloser {
	mw := &multiWriterCloser{
		writers: writers,
		exit:    make(chan struct{}),
	}

	go func() {
		defer close(mw.exit)
		defer func() {
			for _, w := range mw.writers {
				w.Close()
			}
		}()

		buf := make([]byte, DefaultChunkSize)

		for {
			n, err := reader.Read(buf)
			if err != nil {
				if err == io.EOF || err == io.ErrUnexpectedEOF {
					_, err := mw.Write(buf[:n])
					if err != nil {
						log.Printf("error writing to multiwriter: %s", err)
						return
					}

					log.Printf("stdout EOF")

					return
				}

				log.Printf("error reading from stdout: %s", err)

				return
			}

			_, err = mw.Write(buf[:n])
			if err != nil {
				log.Printf("error writing to multiwriter: %s", err)
				return
			}
		}
	}()

	return mw
}

func (mw *multiWriterCloser) Wait() {
	<-mw.exit
}

func (mw *multiWriterCloser) Write(p []byte) (n int, err error) {
	mw.mu.RLock()
	defer mw.mu.RUnlock()

	for _, w := range mw.writers {
		n, err = w.Write(p)
		if err != nil {
			return
		}

		if n < len(p) {
			err = io.ErrShortWrite

			return
		}
	}

	return len(p), nil
}

// Add appends a writer to the list of writers this multiwriter writes to.
func (mw *multiWriterCloser) Add() (io.ReadCloser, func()) {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	r, w := io.Pipe()

	mw.writers = append(mw.writers, w)

	return r, func() {
		w.Close()
		r.Close()
		mw.remove(w)
	}
}

// Remove will remove a previously added writer from the list of writers.
func (mw *multiWriterCloser) remove(w io.WriteCloser) {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	for i, c := range mw.writers {
		if c == w {
			mw.writers = append(mw.writers[:i], mw.writers[i+1:]...)

			break
		}
	}
}

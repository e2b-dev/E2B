package process

import (
	"io"
	"log"
	"sync"
)

type MultiWriter struct {
	writers []io.Writer
	mu      sync.RWMutex
}

func NewMultiWriter(writers ...io.Writer) *MultiWriter {
	return &MultiWriter{
		writers: writers,
	}
}

func (mw *MultiWriter) Write(p []byte) (n int, err error) {
	mw.mu.Lock()
	defer mw.mu.Unlock()

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
func (mw *MultiWriter) Add(w io.Writer) {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	mw.writers = append(mw.writers, w)
}

// Remove will remove a previously added writer from the list of writers.
func (mw *MultiWriter) Remove(w io.Writer) {
	mw.mu.Lock()
	defer mw.mu.Unlock()

	// TODO: Improve removing
	var writers []io.Writer
	for _, ew := range mw.writers {
		if ew != w {
			writers = append(writers, ew)
		}
	}
	mw.writers = writers
}

func multiplexReader(wg *sync.WaitGroup, reader io.Reader) *MultiWriter {
	mw := NewMultiWriter()

	wg.Add(1)
	go func() {
		defer wg.Done()

		buf := make([]byte, defaultChunkSize)

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

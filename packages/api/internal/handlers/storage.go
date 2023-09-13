package handlers

import (
	"cloud.google.com/go/storage"
	"context"
	"fmt"
	"io"
	"time"
)

type cloudStorage struct {
	bucket  string
	client  *storage.Client
	context context.Context
}

// streamFileUpload uploads an object via a stream.
func (cs *cloudStorage) streamFileUpload(name string, content io.Reader) error {
	ctx, cancel := context.WithTimeout(cs.context, time.Second*50)
	defer cancel()

	// Upload an object with storage.Writer.
	wc := cs.client.Bucket(cs.bucket).Object(name).NewWriter(ctx)
	wc.ChunkSize = 0 // note retries are not supported for chunk size 0.

	if _, err := io.Copy(wc, content); err != nil {
		return fmt.Errorf("io.Copy: %w", err)
	}
	// Data can continue to be added to the file until the writer is closed.
	if err := wc.Close(); err != nil {
		return fmt.Errorf("Writer.Close: %w", err)
	}

	return nil
}

// uploadFile uploads an object to the cloud storage bucket.
func (a *APIStore) uploadFile(name string, content io.Reader) error {
	return a.cloudStorage.streamFileUpload(name, content)
}

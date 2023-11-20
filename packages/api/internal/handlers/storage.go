package handlers

import (
	"context"
	"errors"
	"fmt"
	"google.golang.org/api/iterator"
	"io"
	"time"

	"cloud.google.com/go/storage"
)

const streamFileUploadTimeout = 50 * time.Second

type cloudStorage struct {
	client  *storage.Client
	context context.Context
	bucket  string
}

// streamFileUpload uploads an object via a stream and returns the path to the file.
func (cs *cloudStorage) streamFileUpload(name string, content io.Reader) (*string, error) {
	ctx, cancel := context.WithTimeout(cs.context, streamFileUploadTimeout)
	defer cancel()

	// Upload an object with storage.Writer.
	object := cs.client.Bucket(cs.bucket).Object(name)
	wc := object.NewWriter(ctx)
	wc.ChunkSize = 0 // note retries are not supported for chunk size 0.

	if _, err := io.Copy(wc, content); err != nil {
		return nil, fmt.Errorf("io.Copy: %w", err)
	}
	// Data can continue to be added to the file until the writer is closed.
	if err := wc.Close(); err != nil {
		return nil, fmt.Errorf("Writer.Close: %w", err)
	}

	url := fmt.Sprintf("gs://%s/%s", cs.bucket, name)

	return &url, nil
}

// deleteFileOrFolder deletes an object via a stream and returns the path to the file
func (cs *cloudStorage) deleteFolder(ctx context.Context, name string) error {
	objects := cs.client.Bucket(cs.bucket).Objects(ctx, &storage.Query{Prefix: name})
	for { // Iterate over all objects in the folder
		objAttrs, err := objects.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return fmt.Errorf("objects.Next: %w", err)
		}

		if err := cs.client.Bucket(cs.bucket).Object(objAttrs.Name).Delete(ctx); err != nil {
			return fmt.Errorf("Object(%s).Delete: %w", objAttrs.Name, err)
		}
	}
	return nil
}

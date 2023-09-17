package handlers

import (
	"cloud.google.com/go/storage"
	"context"
	"fmt"
	"github.com/hashicorp/go-uuid"
	"io"
	"strings"
	"time"

	"github.com/e2b-dev/api/packages/api/internal/utils"
)

type cloudStorage struct {
	bucket  string
	client  *storage.Client
	context context.Context
}

// streamFileUpload uploads an object via a stream and returns the path to the file.
func (cs *cloudStorage) streamFileUpload(folder string, name string, content io.Reader) (*string, error) {
	ctx, cancel := context.WithTimeout(cs.context, time.Second*50)
	defer cancel()

	prefix := utils.GenerateID() + "-"
	objectName := folder + prefix + name

	// Upload an object with storage.Writer.
	object := cs.client.Bucket(cs.bucket).Object(objectName)
	wc := object.NewWriter(ctx)
	wc.ChunkSize = 0 // note retries are not supported for chunk size 0.

	if _, err := io.Copy(wc, content); err != nil {
		return nil, fmt.Errorf("io.Copy: %w", err)
	}
	// Data can continue to be added to the file until the writer is closed.
	if err := wc.Close(); err != nil {
		return nil, fmt.Errorf("Writer.Close: %w", err)
	}
	url := fmt.Sprintf("gs://%s/%s", cs.bucket, objectName)

	return &url, nil
}

func (a *APIStore) buildEnvs(ctx context.Context, envID string, filename string, content io.Reader) {
	buildID, err := uuid.GenerateUUID()

	if err != nil {
		fmt.Println(err)

		return
	}

	url, err := a.cloudStorage.streamFileUpload(strings.Join([]string{"v1", envID, buildID, ""}, "/"), filename, content)
	if err != nil {
		fmt.Println(err)

		return
	}

	// TODO: Start building env
	println(url)
	//a.nomad.StartBuildingEnv(a.tracer, ctx, envID, url)
	//a.supabase.MarkEnvAsReady(envID)
}

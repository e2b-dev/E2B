package handlers

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/hashicorp/go-uuid"

	"github.com/e2b-dev/api/packages/api/internal/db/models"

	"cloud.google.com/go/storage"
)

type cloudStorage struct {
	client  *storage.Client
	context context.Context
	bucket  string
}

// streamFileUpload uploads an object via a stream and returns the path to the file.
func (cs *cloudStorage) streamFileUpload(name string, content io.Reader) (*string, error) {
	ctx, cancel := context.WithTimeout(cs.context, time.Second*50)
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

func (a *APIStore) buildEnvs(ctx context.Context, envID string, content io.Reader) {
	buildID, err := uuid.GenerateUUID()
	if err != nil {
		err = fmt.Errorf("error when generating build id: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	_, err = a.cloudStorage.streamFileUpload(strings.Join([]string{"v1", envID, buildID, "context.tar.gz"}, "/"), content)
	if err != nil {
		err = fmt.Errorf("error when uploading file to cloud storage: %w", err)
		ReportCriticalError(ctx, err)

		return
	}

	buildResultChan, err := a.nomad.StartBuildingEnv(a.tracer, ctx, envID, buildID)
	if err != nil {
		err = fmt.Errorf("error when starting build: %w", err)
		ReportCriticalError(ctx, err)

		return
	}
	buildResult := <-buildResultChan
	var buildStatus models.EnvStatusEnum
	if buildResult.Error != nil {
		buildStatus = models.EnvStatusEnumError

		err = fmt.Errorf("error when updating env: %w", err)
		ReportCriticalError(ctx, err)
	} else {
		buildStatus = models.EnvStatusEnumReady
	}
	_, err = a.supabase.UpdateStatusEnv(envID, buildStatus)
	if err != nil {
		err = fmt.Errorf("error when updating env: %w", err)
		ReportCriticalError(ctx, err)
	}
}

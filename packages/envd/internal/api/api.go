package api

import (
	"context"
	"net/http"

	"github.com/e2b-dev/infra/packages/envd/internal/files"
	"github.com/e2b-dev/infra/packages/envd/internal/host"
)

type API struct{}

func New() API {
	return API{}
}

func (API) GetFilesystemFilesPath(ctx context.Context, request GetFilesystemFilesPathRequestObject) (GetFilesystemFilesPathResponseObject, error) {

	

	return 
}

func (API) PutFilesystemFilesPath(ctx context.Context, request PutFilesystemFilesPathRequestObject) (PutFilesystemFilesPathResponseObject, error) {
	request.


	// files.HandleUpload(logger *zap.SugaredLogger, w http.ResponseWriter, r *http.Request)
}

func (API) GetHealth(ctx context.Context, request GetHealthRequestObject) (GetHealthResponseObject, error) {
	return GetHealth204Response{}, nil
}

func (API) PostHostSync(ctx context.Context, request PostHostSyncRequestObject) (PostHostSyncResponseObject, error) {
	host.SyncClock()

	return PostHostSync204Response{}, nil
}

package api

import (
	"net/http"

	"github.com/e2b-dev/infra/packages/envd/internal/host"
)

type API struct{}

func New() ServerInterface {
	return API{}
}

func (API) PostSync(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	host.SyncClock()
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "")

	w.WriteHeader(http.StatusNoContent)
}

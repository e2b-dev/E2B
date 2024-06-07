package api

import (
	"net/http"

	"github.com/e2b-dev/infra/packages/envd/internal/host"

	"github.com/rs/zerolog"
)

type API struct {
	logger *zerolog.Logger
}

func New(l *zerolog.Logger) ServerInterface {
	return &API{logger: l}
}

func (API) PostSync(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	host.SyncClock()
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "")

	w.WriteHeader(http.StatusNoContent)
}

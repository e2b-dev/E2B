package api

import (
	"net/http"

	"github.com/e2b-dev/infra/packages/envd/internal/host"
	"github.com/e2b-dev/infra/packages/envd/internal/logs"

	"github.com/rs/zerolog"
)

type API struct {
	logger *zerolog.Logger
}

func New(l *zerolog.Logger) *API {
	return &API{logger: l}
}

func (a *API) PostSync(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	operationID := logs.AssignOperationID()

	a.logger.Debug().Str(string(logs.OperationIDKey), operationID).Msg("Syncing host")

	go func() {
		err := host.Sync()
		if err != nil {
			a.logger.Error().Str(string(logs.OperationIDKey), operationID).Msgf("Failed to sync clock: %v", err)
		} else {
			a.logger.Trace().Str(string(logs.OperationIDKey), operationID).Msg("Clock synced")
		}
	}()

	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "")

	w.WriteHeader(http.StatusNoContent)
}

func (a *API) GetHealth(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	a.logger.Debug().Msg("Health check")

	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "")

	w.WriteHeader(http.StatusNoContent)
}

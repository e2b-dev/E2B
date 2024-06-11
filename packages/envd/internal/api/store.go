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

func (a *API) PostSync(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	go func() {
		err := host.Sync()
		if err != nil {
			a.logger.Error().Msgf("failed to sync clock: %v", err)
		} else {
			a.logger.Trace().Msg("clock synced")
		}
	}()

	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "")

	w.WriteHeader(http.StatusNoContent)
}

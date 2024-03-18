package handlers

import "net/http"

func (a *APIStore) HealthCheck(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)

	return
}

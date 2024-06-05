package api

import (
	"encoding/json"
	"errors"
	"net/http"
)

func jsonError(w http.ResponseWriter, code int, err error) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	w.WriteHeader(code)
	encodeErr := json.NewEncoder(w).Encode(Error{
		Code:    code,
		Message: err.Error(),
	})
	if encodeErr != nil {
		http.Error(w, errors.Join(encodeErr, err).Error(), http.StatusInternalServerError)
	}
}

package handlers

import (
	"fmt"
	"log"
	"net/http"

	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/auth"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/constants"
)

func (a *APIStore) Login(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	// If the request doesn't have the Authorization header, we return 401 with the url for authentication
	if r.Header.Get("Authorization") == "" {
		w.Header().Set("Www-Authenticate", fmt.Sprintf("Bearer realm=\"https://docker.%s/v2/token\"", constants.Domain))
		w.WriteHeader(http.StatusUnauthorized)

		return fmt.Errorf("no authorization header")
	}

	authHeader := r.Header.Get("Authorization")
	accessToken, err := auth.ExtractAccessToken(authHeader, "Bearer")
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(err.Error()))

		return fmt.Errorf("error while extracting access token: %s", err)
	}

	if !auth.ValidateAccessToken(ctx, a.db.Client, accessToken) {
		log.Printf("Login failed. Invalid access token: '%s'\n", accessToken)

		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte("invalid access token"))

		return fmt.Errorf("invalid access token")
	}

	w.WriteHeader(http.StatusOK)

	return nil
}

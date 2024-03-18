package handlers

import (
	"fmt"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/auth"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/constants"
	"net/http"
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

		return fmt.Errorf("error while extracting access token: %s", err)
	}

	if !auth.ValidateAccessToken(ctx, a.db.Client, accessToken) {
		w.WriteHeader(http.StatusUnauthorized)

		return fmt.Errorf("invalid access token")
	}

	fmt.Printf("Token: %s\n", r.Header.Get("Authorization"))
	w.WriteHeader(http.StatusOK)

	return nil
}

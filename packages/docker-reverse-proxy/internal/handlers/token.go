package handlers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/auth"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/constants"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/utils"
	"io"
	"net/http"
	"strings"
)

type DockerToken struct {
	Token     string `json:"token"`
	ExpiresIn int    `json:"expires_in"`
}

func (a *APIStore) GetToken(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	authHeader := r.Header.Get("Authorization")
	encodedLoginInfo := strings.TrimPrefix(authHeader, "Basic ")
	loginInfo, err := base64.StdEncoding.DecodeString(encodedLoginInfo)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)

		return fmt.Errorf("Error: %s\n", err)

	}

	loginInfoParts := strings.Split(string(loginInfo), ":")
	if len(loginInfoParts) != 2 {
		w.WriteHeader(http.StatusBadRequest)

		return fmt.Errorf("Error: invalid login info\n")
	}

	username := loginInfoParts[0]
	if username != "_e2b_access_token" {
		w.WriteHeader(http.StatusUnauthorized)

		return fmt.Errorf("Error: invalid username\n")
	}

	accessToken := loginInfoParts[1]
	scope := r.URL.Query().Get("scope")
	if scope == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"token": "%s", "expires_in": 360000}`, strings.TrimPrefix(r.Header.Get("Authorization"), "Basic "))))
	} else {
		if !strings.HasPrefix(scope, fmt.Sprintf("repository:%s/%s/", constants.GCPProject, constants.DockerRegistry)) {
			w.WriteHeader(http.StatusForbidden)

			return fmt.Errorf("Error: invalid scope\n")

		}

		prefix := fmt.Sprintf("repository:%s/%s/", constants.GCPProject, constants.DockerRegistry)
		scopeWithoutRepository := strings.TrimPrefix(scope, prefix)
		envID := strings.Split(scopeWithoutRepository, ":")[0]

		hasAccess, err := auth.Validate(ctx, a.db.Client, accessToken, envID)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)

			return fmt.Errorf("Error: %s\n", err)
		}

		if !hasAccess {
			w.WriteHeader(http.StatusForbidden)

			return fmt.Errorf("Access denied\n")
		}

		dockerToken, err := getToken(scope)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)

			return fmt.Errorf("Error: %s\n", err)
		}

		userToken := utils.GenerateRandomString(128)
		jsonResponse := fmt.Sprintf(`{"token": "%s", "expires_in": %d}`, userToken, dockerToken.ExpiresIn)

		a.AuthCache.Create(userToken, envID, dockerToken.Token)

		fmt.Printf("Encoded: %s\n", userToken)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(jsonResponse))
	}

	return nil
}

func getToken(scope string) (*DockerToken, error) {
	r, err := http.NewRequest(http.MethodGet, fmt.Sprintf("https://us-central1-docker.pkg.dev/v2/token?service=us-central1-docker.pkg.dev&scope=%s", scope), nil)
	if err != nil {
		fmt.Println("Error: ", err)
		return nil, err
	}

	encodedKey := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("_json_key_base64:%s", constants.GoogleServiceAccountSecret)))
	r.Header.Set("Authorization", fmt.Sprintf("Basic %s", encodedKey))

	resp, err := http.DefaultClient.Do(r)
	defer resp.Body.Close()
	if err != nil {
		fmt.Println("Error: ", err)
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		body := make([]byte, resp.ContentLength)
		_, err := resp.Body.Read(body)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		fmt.Println("Body: ", string(body))
		fmt.Println("Status code: ", resp.StatusCode)

		return nil, fmt.Errorf("status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	fmt.Println("Token response - Body: ", string(body))
	parsedBody := &DockerToken{}
	err = json.Unmarshal(body, parsedBody)
	if err != nil {
		return nil, err
	}

	return parsedBody, nil
}

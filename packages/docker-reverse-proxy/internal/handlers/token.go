package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/auth"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/constants"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/utils"
)

type DockerToken struct {
	Token     string `json:"token"`
	ExpiresIn int    `json:"expires_in"`
}

// expiresIn is the expiration time for the token in seconds, it's an access token and it still the same, no need to refresh it
const expiresIn = 60 * 60 * 24 * 30 // 30 days

// The scope is in format "repository:<project>/<repo>/<templateID>:<action>"
var scopeRegex = regexp.MustCompile(fmt.Sprintf(`^repository:e2b/custom-envs/(?P<templateID>[^:]+):(?P<action>[^:]+)$`))

// GetToken validates if user has access to template and then returns a new token for required scope
func (a *APIStore) GetToken(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	// To get the token the docker CLI uses Basic Auth in format "username:password",
	// where username should be "_e2b_access_token" and password is the actual access token
	authHeader := r.Header.Get("Authorization")

	accessToken, err := auth.ExtractAccessToken(authHeader, "Basic ")
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)

		return fmt.Errorf("error while extracting access token: %s", err)
	}

	// There are two types of requests:
	// 1. Request for token without scope (the initial login request) - we return the same token -> it's used for requesting the token with scope
	// 2. Request for token with scope
	scope := r.URL.Query().Get("scope")
	if scope == "" {
		if !auth.ValidateAccessToken(ctx, a.db.Client, accessToken) {
			w.WriteHeader(http.StatusUnauthorized)

			return fmt.Errorf("invalid access token")
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		// The same token is returned for the initial login request
		response := fmt.Sprintf(`{"token": "%s", "expires_in": %d}`, strings.TrimPrefix(authHeader, "Basic "), expiresIn)
		w.Write([]byte(response))

		return nil
	}

	scopeRegexMatches := scopeRegex.FindStringSubmatch(scope)
	if len(scopeRegexMatches) == 0 {
		w.WriteHeader(http.StatusBadRequest)

		return fmt.Errorf("invalid scope %s", scope)
	}

	templateID := scopeRegexMatches[1]
	action := scopeRegexMatches[2]

	// Don't allow a delete actions
	if strings.Contains(action, "delete") {
		w.WriteHeader(http.StatusForbidden)

		return fmt.Errorf("access denied for scope %s", scope)
	}

	// Validate if user has access to the template
	hasAccess, err := auth.Validate(ctx, a.db.Client, accessToken, templateID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)

		return fmt.Errorf("error while validating access: %s", err)
	}

	if !hasAccess {
		w.WriteHeader(http.StatusForbidden)

		return fmt.Errorf("access denied for env: %s", templateID)
	}

	// Get docker token from the actual registry for the scope
	dockerToken, err := getToken(templateID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)

		return fmt.Errorf("error while getting docker token: %s", err)
	}

	// Create a new e2b token for the user and store it in the cache
	userToken := utils.GenerateRandomString(128)
	jsonResponse := fmt.Sprintf(`{"token": "%s", "expires_in": %d}`, userToken, dockerToken.ExpiresIn)

	a.AuthCache.Create(userToken, templateID, dockerToken.Token)

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(jsonResponse))

	return nil
}

// getToken gets a new token from the actual registry for the required scope
func getToken(templateID string) (*DockerToken, error) {
	url := fmt.Sprintf(
		"https://%s-docker.pkg.dev/v2/token?service=%s-docker.pkg.dev/token&scope=repository:%s/%s/%s:push,pull",
		constants.GCPRegion,
		constants.GCPRegion,
		constants.GCPProject,
		constants.DockerRegistry,
		templateID,
	)

	r, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request for scope - %s: %w", templateID, err)
	}

	// Use the service account credentials for the request
	r.Header.Set("Authorization", fmt.Sprintf("Basic %s", constants.EncodedDockerCredentials))

	resp, err := http.DefaultClient.Do(r)
	defer resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to get token for scope - %s: %w", templateID, err)
	}

	if resp.StatusCode != http.StatusOK {
		body := make([]byte, resp.ContentLength)
		_, err := resp.Body.Read(body)
		if err != nil {
			return nil, fmt.Errorf("failed to read body for failed token acquisition (%d) for scope - %s: %w", resp.StatusCode, templateID, err)
		}
		defer resp.Body.Close()

		return nil, fmt.Errorf("failed to get token (%d) for scope - %s: %s", resp.StatusCode, templateID, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read body for successful token acquisition for scope - %s: %w", templateID, err)
	}

	parsedBody := &DockerToken{}
	err = json.Unmarshal(body, parsedBody)
	if err != nil {
		return nil, fmt.Errorf("failed to parse body for successful token acquisition for scope - %s: %w", templateID, err)
	}

	return parsedBody, nil
}

package middleware

import (
	"context"
	"errors"
	"fmt"
	"github.com/e2b-dev/api/packages/api/internal/constants"
	"net/http"
	"strings"

	middleware "github.com/deepmap/oapi-codegen/pkg/gin-middleware"
	"github.com/getkin/kin-openapi/openapi3filter"
)

var (
	ErrNoAuthHeader      = errors.New("authorization header is missing")
	ErrInvalidAuthHeader = errors.New("authorization header is malformed")
)

// getApiKeyFromRequest extracts an API key from the header.
func getAPIKeyFromRequest(req *http.Request) (string, error) {
	apiKey := req.Header.Get("X-API-Key")
	// Check for the Authorization header.
	if apiKey == "" {
		return "", ErrNoAuthHeader
	}

	// We expect a header value of the form "e2b_<token>"
	// Bearer, per spec.
	prefix := "e2b_"
	if !strings.HasPrefix(apiKey, prefix) {
		return "", ErrInvalidAuthHeader
	}

	return apiKey, nil
}

// authenticate uses the specified validator to ensure an API key is valid.
func authenticate(getTeamFromAPIKey func(string) (string, error), ctx context.Context, input *openapi3filter.AuthenticationInput) error {
	// Our security scheme is named ApiKeyAuth, ensure this is the case
	if input.SecuritySchemeName != "ApiKeyAuth" {
		return fmt.Errorf("security scheme %s != 'ApiKeyAuth'", input.SecuritySchemeName)
	}

	// Now, we need to get the API key from the request
	apiKey, err := getAPIKeyFromRequest(input.RequestValidationInput.Request)
	if err != nil {
		return fmt.Errorf("invalid API key, please visit https://e2b.dev/docs?reason=sdk-missing-api-key to get your API key: %w", err)
	}

	// If the API key is valid, we will get a team ID back
	teamID, err := getTeamFromAPIKey(apiKey)
	if err != nil {
		return fmt.Errorf("invalid API key, please visit https://e2b.dev/docs?reason=sdk-missing-api-key to get your API key: %w", err)
	}

	// Set the property on the gin context so the handler is able to
	// access the claims data we generate in here.
	middleware.GetGinContext(ctx).Set(constants.TeamIDContextKey, teamID)

	return nil
}

// NewAuthenticator returns a new authenticator middleware.
func NewAuthenticator(getTeamFromAPIKey func(string) (string, error)) openapi3filter.AuthenticationFunc {
	return func(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
		return authenticate(getTeamFromAPIKey, ctx, input)
	}
}

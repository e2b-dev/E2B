package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/e2b-dev/infra/packages/api/internal/db/ent"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/google/uuid"
	middleware "github.com/oapi-codegen/gin-middleware"

	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

var (
	ErrNoAuthHeader      = errors.New("authorization header is missing")
	ErrInvalidAuthHeader = errors.New("authorization header is malformed")
)

type authenticator[T any] struct {
	securitySchemeName string
	headerKey          string
	prefix             string
	removePrefix       string
	validationFunction func(context.Context, string) (T, error)
	contextKey         string
	errorMessage       string
}

// getApiKeyFromRequest extracts an API key from the header.
func (a *authenticator[T]) getAPIKeyFromRequest(req *http.Request) (string, error) {
	apiKey := req.Header.Get(a.headerKey)
	// Check for the Authorization header.
	if apiKey == "" {
		return "", ErrNoAuthHeader
	}

	// Remove the prefix from the API key
	if a.removePrefix != "" {
		apiKey = strings.TrimSpace(strings.TrimPrefix(apiKey, a.removePrefix))
	}

	// We expect a header value to be in a special form
	if !strings.HasPrefix(apiKey, a.prefix) {
		return "", ErrInvalidAuthHeader
	}

	return apiKey, nil
}

// Authenticate uses the specified validator to ensure an API key is valid.
func (a *authenticator[T]) Authenticate(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
	// Our security scheme is named ApiKeyAuth, ensure this is the case
	if input.SecuritySchemeName != a.securitySchemeName {
		return fmt.Errorf("security scheme %s != '%s'", a.securitySchemeName, input.SecuritySchemeName)
	}

	// Now, we need to get the API key from the request
	apiKey, err := a.getAPIKeyFromRequest(input.RequestValidationInput.Request)
	if err != nil {
		return fmt.Errorf("%v %w", a.errorMessage, err)
	}

	// If the API key is valid, we will get a result back
	result, err := a.validationFunction(ctx, apiKey)
	if err != nil {
		return fmt.Errorf("%s %w", a.errorMessage, err)
	}

	telemetry.ReportEvent(ctx, "validated "+a.securitySchemeName)
	// Set the property on the gin context
	middleware.GetGinContext(ctx).Set(a.contextKey, result)

	return nil
}

func CreateAuthenticationFunc(teamValidationFunction func(context.Context, string) (ent.Team, error), userValidationFunction func(context.Context, string) (uuid.UUID, error)) func(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
	apiKeyValidator := authenticator[ent.Team]{
		securitySchemeName: "ApiKeyAuth",
		headerKey:          "X-API-Key",
		prefix:             "e2b_",
		removePrefix:       "",
		validationFunction: teamValidationFunction,
		contextKey:         constants.TeamContextKey,
		errorMessage:       "invalid API key, please visit https://e2b.dev/docs?reason=sdk-missing-api-key to get your API key:",
	}
	accessTokenValidator := authenticator[uuid.UUID]{
		securitySchemeName: "AccessTokenAuth",
		headerKey:          "Authorization",
		prefix:             "sk_e2b_",
		removePrefix:       "Bearer ",
		validationFunction: userValidationFunction,
		contextKey:         constants.UserIDContextKey,
		errorMessage:       "invalid Access token, try to login again by running `e2b login`:",
	}

	return func(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
		if input.SecuritySchemeName == apiKeyValidator.securitySchemeName {
			return apiKeyValidator.Authenticate(ctx, input)
		}

		if input.SecuritySchemeName == accessTokenValidator.securitySchemeName {
			return accessTokenValidator.Authenticate(ctx, input)
		}

		return fmt.Errorf("invalid security scheme name '%s'", input.SecuritySchemeName)
	}
}

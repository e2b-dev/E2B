package utils

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"github.com/gin-gonic/gin"
)

func ParseBody[B any](ctx context.Context, c *gin.Context) (body B, err error) {
	err = c.Bind(&body)
	if err != nil {
		bodyErr := fmt.Errorf("error when parsing request: %w", err)

		telemetry.ReportCriticalError(ctx, bodyErr)

		return body, bodyErr
	}

	return body, nil
}

func ParseJSONBody[B any](ctx context.Context, body io.ReadCloser) (*B, error) {
	defer body.Close()

	var result B

	err := json.NewDecoder(body).Decode(&result)
	if err != nil {
		return nil, fmt.Errorf("error when parsing request: %w", err)
	}

	return &result, nil
}

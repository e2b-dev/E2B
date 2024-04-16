package test

import (
	"context"
	"github.com/e2b-dev/infra/packages/template-manager/internal/template"
	"time"

	artifactregistry "cloud.google.com/go/artifactregistry/apiv1"
	"go.opentelemetry.io/otel"
)

func Delete(templateID string) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	tracer := otel.Tracer("test")

	artifactRegistry, err := artifactregistry.NewClient(ctx)
	if err != nil {
		panic(err)
	}

	err = template.Delete(ctx, tracer, artifactRegistry, templateID)
	if err != nil {
		panic(err)
	}
}

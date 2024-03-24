package internal

import (
	"context"
	"time"

	artifactregistry "cloud.google.com/go/artifactregistry/apiv1"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/shared/pkg/storages"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"github.com/hashicorp/nomad/plugins/drivers"

	"github.com/e2b-dev/infra/packages/template-delete-task-driver/internal/template"
)

type extraTaskHandle struct {
	template         *template.Template
	storage          *storages.GoogleCloudStorage
	artifactRegistry *artifactregistry.Client
}

func (h *extraTaskHandle) GetDriverAttributes() map[string]string {
	return map[string]string{
		"template_id": h.template.TemplateID,
	}
}

func (h *extraTaskHandle) Run(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "run")
	defer childSpan.End()

	err := h.template.Delete(childCtx, tracer, h.artifactRegistry, h.storage)
	if err != nil {
		telemetry.ReportCriticalError(childCtx, err)

		return err
	}

	return nil
}

func (h *extraTaskHandle) Stats(ctx context.Context, statsChannel chan *drivers.TaskResourceUsage, interval time.Duration) {
	defer close(statsChannel)
	for {
		select {
		case <-ctx.Done():
			return
		}
	}
}

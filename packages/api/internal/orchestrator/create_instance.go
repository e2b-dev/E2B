package orchestrator

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/sandbox"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func (o *Orchestrator) CreateSandbox(
	t trace.Tracer,
	ctx context.Context,
	sandboxID,
	templateID,
	alias,
	teamID,
	buildID string,
	maxInstanceLengthHours int64,
	metadata map[string]string,
	kernelVersion,
	firecrackerVersion string,
) (*api.Sandbox, error) {
	childCtx, childSpan := t.Start(ctx, "create-sandbox",
		trace.WithAttributes(
			attribute.String("env.id", templateID),
		),
	)
	defer childSpan.End()

	traceID := childSpan.SpanContext().TraceID().String()
	spanID := childSpan.SpanContext().SpanID().String()

	metadataSerialized, err := json.Marshal(metadata)
	if err != nil {
		errMsg := fmt.Errorf("failed to marshal metadata: %w", err)

		return nil, fmt.Errorf("failed to marshal metadata: %w", errMsg)
	}

	telemetry.ReportEvent(childCtx, "Marshalled metadata")

	telemetry.SetAttributes(
		childCtx,
		attribute.String("passed_trace_id_hex", traceID),
		attribute.String("passed_span_id_hex", spanID),
	)

	features, err := sandbox.NewVersionInfo(firecrackerVersion)
	if err != nil {
		errMsg := fmt.Errorf("failed to get features for firecracker version '%s': %w", firecrackerVersion, err)

		return nil, fmt.Errorf("failed to get features for firecracker version '%s': %w", firecrackerVersion, errMsg)
	}

	telemetry.ReportEvent(childCtx, "Got FC version info")

	res, err := o.grpc.Client.SandboxCreate(ctx, &orchestrator.SandboxCreateRequest{
		TemplateID:         templateID,
		Alias:              alias,
		TeamID:             teamID,
		BuildID:            buildID,
		SandboxID:          sandboxID,
		TraceID:            traceID,
		KernelVersion:      kernelVersion,
		FirecrackerVersion: firecrackerVersion,
		Metadata:           string(metadataSerialized),
		MaxInstanceLength:  int32(maxInstanceLengthHours),
		HugePages:          features.HasHugePages(),
		SpanID:             spanID,
	})
	if err != nil {
		errMsg := fmt.Errorf("failed to create sandbox of environment '%s': %w", templateID, err)

		return nil, fmt.Errorf("failed to create sandbox of environment '%s': %w", templateID, errMsg)
	}

	telemetry.ReportEvent(childCtx, "Created sandbox")

	return &api.Sandbox{
		ClientID:   res.ClientID,
		SandboxID:  sandboxID,
		TemplateID: templateID,
		Alias:      &alias,
	}, nil
}

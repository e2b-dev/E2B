package orchestrator

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/status"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/sandbox"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
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

	metadataSerialized, err := json.Marshal(metadata)
	if err != nil {
		errMsg := fmt.Errorf("failed to marshal metadata: %w", err)

		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "Marshalled metadata")

	features, err := sandbox.NewVersionInfo(firecrackerVersion)
	if err != nil {
		errMsg := fmt.Errorf("failed to get features for firecracker version '%s': %w", firecrackerVersion, err)

		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "Got FC version info")

	res, err := o.grpc.Client.SandboxCreate(ctx, &orchestrator.SandboxCreateRequest{
		TemplateID:         templateID,
		Alias:              alias,
		TeamID:             teamID,
		BuildID:            buildID,
		SandboxID:          sandboxID,
		KernelVersion:      kernelVersion,
		FirecrackerVersion: firecrackerVersion,
		Metadata:           string(metadataSerialized),
		MaxInstanceLength:  int32(maxInstanceLengthHours),
		HugePages:          features.HasHugePages(),
	})
	if err != nil {
		st, ok := status.FromError(err)
		if !ok {
			errMsg := fmt.Errorf("failed to create sandbox '%s': %w", templateID, err)
			telemetry.ReportCriticalError(childCtx, errMsg)

			return nil, errMsg
		}

		telemetry.ReportCriticalError(
			childCtx,
			fmt.Errorf("failed to create sandbox '%s': [%s] %s", templateID, st.Code(), st.Message()),
		)
		errMsg := fmt.Errorf("failed to create sandbox of environment '%s': %s", templateID, st.Message())

		return nil, errMsg
	}

	telemetry.ReportEvent(childCtx, "Created sandbox")

	return &api.Sandbox{
		ClientID:   res.ClientID,
		SandboxID:  sandboxID,
		TemplateID: templateID,
		Alias:      &alias,
	}, nil
}

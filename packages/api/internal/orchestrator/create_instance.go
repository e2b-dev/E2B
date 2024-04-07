package orchestrator

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/sandbox"
	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const (
	envsDisk = "/mnt/disks/fc-envs/v1"

	instanceJobName          = "env-instance"
	instanceJobNameWithSlash = instanceJobName + "/"
	InstanceIDPrefix         = "i"

	instanceStartTimeout = time.Second * 20
)

var (
	logsProxyAddress = os.Getenv("LOGS_PROXY_ADDRESS")
	consulToken      = os.Getenv("CONSUL_TOKEN")
)

func (o *Orchestrator) CreateSandbox(
	t trace.Tracer,
	ctx context.Context,
	instanceID,
	envID,
	alias,
	teamID,
	buildID string,
	maxInstanceLengthHours int64,
	metadata map[string]string,
	kernelVersion,
	firecrackerVersion string,
) (*api.Sandbox, error) {
	childCtx, childSpan := t.Start(ctx, "create-instance",
		trace.WithAttributes(
			attribute.String("env.id", envID),
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

	res, err := o.client.PostSandboxes(ctx, PostSandboxesJSONRequestBody{
		EnvID:              envID,
		Alias:              alias,
		TeamID:             teamID,
		BuildID:            buildID,
		InstanceID:         instanceID,
		TraceID:            traceID,
		ConsulToken:        consulToken,
		LogsProxyAddress:   logsProxyAddress,
		KernelVersion:      kernelVersion,
		EnvsDisk:           envsDisk,
		FirecrackerVersion: firecrackerVersion,
		Metadata:           string(metadataSerialized),
		MaxInstanceLength:  int32(maxInstanceLengthHours),
		HugePages:          features.HasHugePages(),
		SpanID:             spanID,
	})
	if err != nil {
		errMsg := fmt.Errorf("failed to create instance of environment '%s': %w", envID, err)

		return nil, fmt.Errorf("failed to create instance of environment '%s': %w", envID, errMsg)
	}

	if res == nil {
		errMsg := fmt.Errorf("failed to create instance of environment '%s'", envID)

		return nil, fmt.Errorf("failed to create instance of environment '%s': %w", envID, errMsg)
	}

	if res.StatusCode != http.StatusCreated {
		errMsg := fmt.Errorf("failed to create instance of environment '%s': %s", envID, res.Status)

		return nil, fmt.Errorf("failed to create instance of environment '%s': %w", envID, errMsg)
	}

	telemetry.ReportEvent(childCtx, "Created instance")

	body, bodyErr := utils.ParseJSONBody[NewSandbox](ctx, res.Body)
	if bodyErr != nil {
		errMsg := fmt.Errorf("failed to parse response body: %w", bodyErr)

		return nil, fmt.Errorf("failed to parse response body: %w", errMsg)
	}

	telemetry.ReportEvent(childCtx, "Parsed response body")

	if body == nil {
		errMsg := fmt.Errorf("failed to parse response body")

		return nil, fmt.Errorf("failed to parse response body: %w", errMsg)
	}

	return &api.Sandbox{
		ClientID:   body.ClientID,
		SandboxID:  instanceID,
		TemplateID: envID,
		Alias:      &alias,
	}, nil
}

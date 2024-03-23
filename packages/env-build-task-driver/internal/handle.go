package internal

import (
	"context"
	"fmt"
	"time"

	"github.com/docker/docker/client"
	"github.com/e2b-dev/infra/packages/env-build-task-driver/internal/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	docker "github.com/fsouza/go-dockerclient"
	"github.com/hashicorp/nomad/api"
	"github.com/hashicorp/nomad/plugins/drivers"
	"go.opentelemetry.io/otel/trace"
)

type extraTaskHandle struct {
	env          *env.Env
	docker       *client.Client
	legacyDocker *docker.Client
	nomadToken   string
}

func (h *extraTaskHandle) GetDriverAttributes() map[string]string {
	return map[string]string{
		"env_id":   h.env.EnvID,
		"build_id": h.env.BuildID,
	}
}

func (h *extraTaskHandle) Run(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "run")
	defer childSpan.End()

	err := h.env.Build(childCtx, tracer, h.docker, h.legacyDocker)
	if err != nil {
		telemetry.ReportCriticalError(childCtx, err)

		return err
	}

	config := api.DefaultConfig()
	config.SecretID = h.nomadToken
	nomadClient, err := api.NewClient(config)
	if err != nil {
		errMsg := fmt.Errorf("error creating nomad client: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	variable := &api.Variable{
		Path:  "env-build/disk-size-mb/" + h.env.EnvID,
		Items: api.VariableItems{h.env.BuildID: fmt.Sprintf("%d", h.env.RootfsSize()>>env.ToMBShift)},
	}
	_, _, err = nomadClient.Variables().Create(variable, nil)
	if err != nil {
		errMsg := fmt.Errorf("error creating nomad variable: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(ctx, fmt.Sprintf("building env '%s' with build id '%s' successful", h.env.EnvID, h.env.BuildID))

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

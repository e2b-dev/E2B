package template_manager

import (
	"context"
	_ "embed"
	"fmt"
	"io"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/status"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/nomad"
	"github.com/e2b-dev/infra/packages/api/internal/sandbox"
	"github.com/e2b-dev/infra/packages/shared/pkg/db"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/template-manager"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envbuild"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func (tm *TemplateManager) CreateTemplate(
	t trace.Tracer,
	ctx context.Context,
	db *db.DB,
	buildCache *nomad.BuildCache,
	templateID string,
	buildID uuid.UUID,
	kernelVersion,
	firecrackerVersion,
	startCommand string,
	diskSizeMB,
	vCpuCount,
	memoryMB int64,
) error {
	// TODO:
	diskSize := int64(0)
	childCtx, childSpan := t.Start(ctx, "create-sandbox",
		trace.WithAttributes(
			attribute.String("env.id", templateID),
		),
	)
	defer childSpan.End()

	features, err := sandbox.NewVersionInfo(firecrackerVersion)
	if err != nil {
		errMsg := fmt.Errorf("failed to get features for firecracker version '%s': %w", firecrackerVersion, err)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "Got FC version info")

	logs, err := tm.grpc.Client.TemplateCreate(ctx, &template_manager.TemplateCreateRequest{
		TemplateID:         templateID,
		BuildID:            buildID.String(),
		VCpuCount:          int32(vCpuCount),
		MemoryMB:           int32(memoryMB),
		DiskSizeMB:         int32(diskSizeMB),
		KernelVersion:      kernelVersion,
		FirecrackerVersion: firecrackerVersion,
		HugePages:          features.HasHugePages(),
		StartCommand:       startCommand,
	})
	if err != nil {
		st, ok := status.FromError(err)
		if !ok {
			errMsg := fmt.Errorf("failed to create sandbox '%s': %w", templateID, err)
			telemetry.ReportCriticalError(childCtx, errMsg)

			return errMsg
		}

		telemetry.ReportCriticalError(
			childCtx,
			fmt.Errorf("failed to create sandbox '%s': [%s] %s", templateID, st.Code(), st.Message()),
		)
		errMsg := fmt.Errorf("failed to create sandbox of environment '%s': %s", templateID, st.Message())

		return errMsg
	}

	go func() {
		buildContext, buildSpan := t.Start(
			trace.ContextWithSpanContext(context.Background(), childSpan.SpanContext()),
			"background-build-template",
		)
		defer buildSpan.End()
		for {
			log, receiveErr := logs.Recv()
			if receiveErr == io.EOF {
				break
			} else if receiveErr != nil {
				errMsg := fmt.Errorf("error when building env: %w", receiveErr)
				handleBuildErr(ctx, db, buildCache, templateID, buildID, errMsg)

				return
			}

			logErr := buildCache.Append(templateID, buildID, log.Log)
			if logErr != nil {
				errMsg := fmt.Errorf("error when saving docker build logs: %w", logErr)
				telemetry.ReportError(buildContext, errMsg)

				break
			}
		}

		err = db.FinishEnvBuild(buildContext, templateID, buildID, diskSize)
		if err != nil {
			err = fmt.Errorf("error when finishing build: %w", err)
			telemetry.ReportCriticalError(buildContext, err)

			return
		}

		telemetry.ReportEvent(buildContext, "created new environment", attribute.String("env.id", templateID))

		cacheErr := buildCache.SetDone(templateID, buildID, api.TemplateBuildStatusReady)
		if cacheErr != nil {
			err = fmt.Errorf("error when setting build done in logs: %w", cacheErr)
			telemetry.ReportCriticalError(buildContext, cacheErr)
		}
	}()

	telemetry.ReportEvent(childCtx, "Template build started")

	return nil
}

func handleBuildErr(
	ctx context.Context,
	db *db.DB,
	buildCache *nomad.BuildCache,
	templateID string,
	buildID uuid.UUID,
	buildErr error,
) {
	telemetry.ReportCriticalError(ctx, buildErr)

	err := db.EnvBuildSetStatus(ctx, templateID, buildID, envbuild.StatusFailed)
	if err != nil {
		err = fmt.Errorf("error when setting build status: %w", err)
		telemetry.ReportCriticalError(ctx, err)
	}

	cacheErr := buildCache.SetDone(templateID, buildID, api.TemplateBuildStatusError)
	if cacheErr != nil {
		err = fmt.Errorf("error when setting build done in logs: %w", cacheErr)
		telemetry.ReportCriticalError(ctx, cacheErr)
	}
	return
}

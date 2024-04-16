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
	"github.com/e2b-dev/infra/packages/api/internal/cache/builds"
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
	buildCache *builds.BuildCache,
	templateID string,
	buildID uuid.UUID,
	kernelVersion,
	firecrackerVersion,
	startCommand string,
	vCpuCount,
	diskSizeMB,
	memoryMB int64,
) error {
	// TODO:
	diskSize := int64(0)
	childCtx, childSpan := t.Start(ctx, "create-template",
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
			errMsg := fmt.Errorf("failed to create template '%s': %w", templateID, err)
			telemetry.ReportCriticalError(childCtx, errMsg)

			return errMsg
		}

		telemetry.ReportCriticalError(
			childCtx,
			fmt.Errorf("failed to create template '%s': [%s] %s", templateID, st.Code(), st.Message()),
		)
		errMsg := fmt.Errorf("failed to create template '%s': %s", templateID, st.Message())

		return errMsg
	}

	// Wait for the build to finish and save logs
	for {
		log, receiveErr := logs.Recv()
		if receiveErr == io.EOF {
			break
		} else if receiveErr != nil {
			// There was an error during the build
			errMsg := fmt.Errorf("error when building env: %w", receiveErr)
			handleBuildErr(ctx, db, buildCache, templateID, buildID, errMsg)

			return errMsg
		} else {
			logErr := buildCache.Append(templateID, buildID, log.Log)
			if logErr != nil {
				// There was an error saving the logs, the build wasn't found
				errMsg := fmt.Errorf("error when saving docker build logs: %w", logErr)
				handleBuildErr(ctx, db, buildCache, templateID, buildID, errMsg)

				return errMsg
			}
		}
	}

	err = db.FinishEnvBuild(childCtx, templateID, buildID, diskSize)
	if err != nil {
		err = fmt.Errorf("error when finishing build: %w", err)
		telemetry.ReportCriticalError(childCtx, err)

		return err
	}

	telemetry.ReportEvent(childCtx, "created new environment", attribute.String("env.id", templateID))

	cacheErr := buildCache.SetDone(templateID, buildID, api.TemplateBuildStatusReady)
	if cacheErr != nil {
		err = fmt.Errorf("error when setting build done in logs: %w", cacheErr)
		telemetry.ReportCriticalError(childCtx, cacheErr)
	}

	telemetry.ReportEvent(childCtx, "Template build started")

	return nil
}

func handleBuildErr(
	ctx context.Context,
	db *db.DB,
	buildCache *builds.BuildCache,
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

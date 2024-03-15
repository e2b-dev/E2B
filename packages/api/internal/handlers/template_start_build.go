package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/posthog/posthog-go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/nomad"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envbuild"
	"github.com/e2b-dev/infra/packages/shared/pkg/schema"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func (a *APIStore) PostTemplatesTemplateIDBuildsBuildID(c *gin.Context, templateID api.TemplateID, buildID api.BuildID) {
	ctx := c.Request.Context()
	span := trace.SpanFromContext(ctx)

	buildUUID, err := uuid.Parse(buildID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Invalid build ID: %s", buildID))

		err = fmt.Errorf("invalid build ID: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	userID, team, _, err := a.GetUserAndTeam(c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	telemetry.ReportEvent(ctx, "started environment build")

	envDB, err := a.supabase.Client.Env.Query().Where(
		env.IDEQ(templateID),
		env.TeamID(team.ID),
	).WithBuilds(
		func(query *models.EnvBuildQuery) {
			query.Where(envbuild.ID(buildUUID))
		},
	).Only(ctx)

	if err != nil {
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error when getting env: %s", err))

		err = fmt.Errorf("error when getting env: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	err = a.buildCache.Create(templateID, buildUUID, team.ID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusConflict, fmt.Sprintf("there's already running build for %s", templateID))

		err = fmt.Errorf("build is already running build for %s", templateID)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	err = a.supabase.EnvBuildSetStatus(ctx, envDB.ID, buildUUID, envbuild.StatusBuilding)
	if err != nil {
		err = fmt.Errorf("error when setting build status: %w", err)
		telemetry.ReportCriticalError(ctx, err)
	}

	go func() {
		buildContext, childSpan := a.tracer.Start(
			trace.ContextWithSpanContext(context.Background(), span.SpanContext()),
			"background-build-env",
		)

		var status api.TemplateBuildStatus

		build := envDB.Edges.Builds[0]
		startCmd := ""
		if build.StartCmd != nil {
			startCmd = *build.StartCmd
		}

		diskSize, buildErr := a.buildEnv(
			buildContext,
			userID.String(),
			team.ID,
			envDB.ID,
			buildUUID,
			startCmd,
			build.KernelVersion,
			build.FirecrackerVersion,
			nomad.BuildConfig{
				VCpuCount:          build.Vcpu,
				MemoryMB:           build.RAMMB,
				DiskSizeMB:         build.FreeDiskSizeMB,
				KernelVersion:      schema.DefaultKernelVersion,
				FirecrackerVersion: schema.DefaultFirecrackerVersion,
			})

		if buildErr != nil {
			status = api.TemplateBuildStatusError

			err = a.supabase.EnvBuildSetStatus(buildContext, envDB.ID, buildUUID, envbuild.StatusFailed)
			if err != nil {
				err = fmt.Errorf("error when setting build status: %w", err)
				telemetry.ReportCriticalError(buildContext, err)
			}

			errMsg := fmt.Errorf("error when building env: %w", buildErr)

			telemetry.ReportCriticalError(buildContext, errMsg)
		} else {
			status = api.TemplateBuildStatusReady
			err = a.supabase.FinishEnvBuild(buildContext, envDB.ID, buildUUID, diskSize)

			telemetry.ReportEvent(buildContext, "created new environment", attribute.String("env.id", templateID))
		}

		cacheErr := a.buildCache.SetDone(templateID, buildUUID, status)
		if cacheErr != nil {
			err = fmt.Errorf("error when setting build done in logs: %w", cacheErr)
			telemetry.ReportCriticalError(buildContext, cacheErr)
		}

		childSpan.End()
	}()

}

func (a *APIStore) buildEnv(
	ctx context.Context,
	userID string,
	teamID uuid.UUID,
	envID string,
	buildID uuid.UUID,
	startCmd,
	envKernelVersion,
	envFirecrackerVersion string,
	vmConfig nomad.BuildConfig,
) (diskSize int64, err error) {
	childCtx, childSpan := a.tracer.Start(ctx, "build-env",
		trace.WithAttributes(
			attribute.String("env.id", envID),
			attribute.String("build.id", buildID.String()),
			attribute.String("env.team.id", teamID.String()),
		),
	)
	defer childSpan.End()

	startTime := time.Now()

	defer func() {
		a.posthog.CreateAnalyticsUserEvent(userID, teamID.String(), "built environment", posthog.NewProperties().
			Set("user_id", userID).
			Set("environment", envID).
			Set("build_id", buildID).
			Set("duration", time.Since(startTime).String()).
			Set("success", err != nil),
		)
	}()

	diskSize, err = a.nomad.BuildEnvJob(
		a.tracer,
		childCtx,
		envID,
		envKernelVersion,
		envFirecrackerVersion,
		buildID.String(),
		startCmd,
		a.apiSecret,
		a.googleServiceAccountBase64,
		vmConfig,
	)
	if err != nil {
		err = fmt.Errorf("error when building env: %w", err)
		telemetry.ReportCriticalError(childCtx, err)

		return diskSize, err
	}

	return diskSize, nil
}

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
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envbuild"
	"github.com/e2b-dev/infra/packages/shared/pkg/schema"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

// PostTemplatesTemplateIDBuildsBuildID triggers a new build after the user pushes the Docker image to the registry
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

	// Check if the user has access to the template, load the template with build info
	envDB, err := a.db.Client.Env.Query().Where(
		env.ID(templateID),
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

	// Create a new build cache for storing logs
	err = a.buildCache.Create(templateID, buildUUID, team.ID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusConflict, fmt.Sprintf("there's already running build for %s", templateID))

		err = fmt.Errorf("build is already running build for %s", templateID)
		telemetry.ReportCriticalError(ctx, err)

		return
	}

	// Set the build status to building
	err = a.db.EnvBuildSetStatus(ctx, envDB.ID, buildUUID, envbuild.StatusBuilding)
	if err != nil {
		err = fmt.Errorf("error when setting build status: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		a.buildCache.Delete(templateID, buildUUID, team.ID)

		return
	}

	// Trigger the build in the background
	go func() {
		buildContext, childSpan := a.tracer.Start(
			trace.ContextWithSpanContext(context.Background(), span.SpanContext()),
			"background-build-env",
		)
		defer childSpan.End()

		build := envDB.Edges.Builds[0]
		startCmd := ""
		if build.StartCmd != nil {
			startCmd = *build.StartCmd
		}

		// Call the Template Manager to build the environment
		buildErr := a.buildEnv(
			buildContext,
			userID.String(),
			team.ID,
			envDB.ID,
			buildUUID,
			startCmd,
			schema.DefaultKernelVersion,
			schema.DefaultFirecrackerVersion,
			build.Vcpu,
			build.RAMMB,
			build.FreeDiskSizeMB,
		)

		if buildErr != nil {
			err = fmt.Errorf("error when building env: %w", buildErr)
			telemetry.ReportCriticalError(buildContext, buildErr)

			a.buildCache.Delete(templateID, buildUUID, team.ID)

			return
		}
	}()

	c.Status(http.StatusAccepted)
}

func (a *APIStore) buildEnv(
	ctx context.Context,
	userID string,
	teamID uuid.UUID,
	envID string,
	buildID uuid.UUID,
	startCmd,
	KernelVersion,
	firecrackerVersion string,
	VCpuCount,
	MemoryMB,
	DiskSizeMB int64,
) (err error) {
	childCtx, childSpan := a.tracer.Start(ctx, "build-env",
		trace.WithAttributes(
			attribute.String("env.id", envID),
			attribute.String("build.id", buildID.String()),
			attribute.String("env.team.id", teamID.String()),
		),
	)
	defer childSpan.End()

	startTime := time.Now()

	err = a.templateManager.CreateTemplate(
		a.tracer,
		childCtx,
		a.db,
		a.buildCache,
		envID,
		buildID,
		KernelVersion,
		firecrackerVersion,
		startCmd,
		MemoryMB,
		VCpuCount,
		DiskSizeMB,
	)
	if err != nil {
		err = fmt.Errorf("error when building env: %w", err)
		telemetry.ReportCriticalError(childCtx, err)

		return err
	}

	a.posthog.CreateAnalyticsUserEvent(userID, teamID.String(), "built environment", posthog.NewProperties().
		Set("user_id", userID).
		Set("environment", envID).
		Set("build_id", buildID).
		Set("duration", time.Since(startTime).String()).
		Set("success", err != nil),
	)

	return nil
}

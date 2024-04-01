package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envalias"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envbuild"
	"github.com/e2b-dev/infra/packages/shared/pkg/schema"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func (a *APIStore) PostTemplates(c *gin.Context) {
	ctx := c.Request.Context()
	envID := utils.GenerateID()

	telemetry.ReportEvent(ctx, "started creating new environment")

	template := a.TemplateRequestBuild(c, envID, true)
	if template != nil {
		c.JSON(http.StatusAccepted, &template)
	}
}

func (a *APIStore) PostTemplatesTemplateID(c *gin.Context, templateID api.TemplateID) {
	cleanedTemplateID, err := utils.CleanEnvID(templateID)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Invalid template ID: %s", cleanedTemplateID))

		err = fmt.Errorf("invalid template ID: %w", err)
		telemetry.ReportCriticalError(c.Request.Context(), err)

		return
	}

	template := a.TemplateRequestBuild(c, cleanedTemplateID, false)

	if template != nil {
		c.JSON(http.StatusAccepted, &template)
	}
}

func (a *APIStore) TemplateRequestBuild(c *gin.Context, templateID api.TemplateID, new bool) *api.Template {
	ctx := c.Request.Context()

	body, err := parseBody[api.TemplateBuildRequest](ctx, c)

	telemetry.ReportEvent(ctx, "started request for environment build")

	// Prepare info for rebuilding env
	userID, team, tier, err := a.GetUserAndTeam(c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when getting default team: %s", err))

		err = fmt.Errorf("error when getting default team: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return nil
	}

	if !new {
		// Check if the user has access to the template
		_, err = a.db.Client.Env.Query().Where(env.ID(templateID), env.TeamID(team.ID)).Only(ctx)
		if err != nil {
			a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error when getting env: %s", err))

			err = fmt.Errorf("error when getting env: %w", err)
			telemetry.ReportCriticalError(ctx, err)

			return nil
		}
	}

	// Generate a build id for the new build
	buildID, err := uuid.NewRandom()
	if err != nil {
		err = fmt.Errorf("error when generating build id: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		a.sendAPIStoreError(c, http.StatusInternalServerError, "Failed to generate build id")

		return nil
	}

	telemetry.SetAttributes(ctx,
		attribute.String("user.id", userID.String()),
		attribute.String("env.team.id", team.ID.String()),
		attribute.String("env.team.name", team.Name),
		attribute.String("env.id", templateID),
		attribute.String("env.team.tier", tier.ID),
		attribute.String("build.id", buildID.String()),
		attribute.String("env.dockerfile", body.Dockerfile),
	)

	if body.Alias != nil {
		telemetry.SetAttributes(ctx, attribute.String("env.alias", *body.Alias))
	}
	if body.StartCmd != nil {
		telemetry.SetAttributes(ctx, attribute.String("env.start_cmd", *body.StartCmd))
	}

	if body.CpuCount != nil {
		telemetry.SetAttributes(ctx, attribute.Int("env.cpu", *body.CpuCount))
	}

	if body.MemoryMB != nil {
		telemetry.SetAttributes(ctx, attribute.Int("env.memory_mb", *body.MemoryMB))
	}

	cpuCount, ramMB, apiError := getCPUAndRAM(tier.ID, body.CpuCount, body.MemoryMB)
	if apiError != nil {
		telemetry.ReportCriticalError(ctx, apiError.Err)
		a.sendAPIStoreError(c, apiError.Code, apiError.ClientMsg)

		return nil
	}

	var alias string
	if body.Alias != nil {
		alias, err = utils.CleanEnvID(*body.Alias)
		if err != nil {
			a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Invalid alias: %s", alias))

			err = fmt.Errorf("invalid alias: %w", err)
			telemetry.ReportCriticalError(ctx, err)

			return nil
		}
	}

	// Start a transaction to prevent partial updates
	tx, err := a.db.Client.Tx(ctx)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when starting transaction: %s", err))

		err = fmt.Errorf("error when starting transaction: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return nil
	}
	defer tx.Rollback()

	// Create the template / or update the build count
	err = tx.
		Env.
		Create().
		SetID(templateID).
		SetTeamID(team.ID).
		SetPublic(false).
		OnConflictColumns(env.FieldID).
		UpdateUpdatedAt().
		Update(func(e *models.EnvUpsert) {
			e.AddBuildCount(1)
		}).
		Exec(ctx)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when updating env: %s", err))

		err = fmt.Errorf("error when updating env: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return nil
	}

	// Mark the previous not started builds as failed
	err = tx.EnvBuild.Update().Where(
		envbuild.EnvID(templateID),
		envbuild.StatusEQ(envbuild.StatusWaiting),
	).SetStatus(envbuild.StatusFailed).SetFinishedAt(time.Now()).Exec(ctx)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when updating env: %s", err))

		err = fmt.Errorf("error when updating env: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return nil
	}

	// Insert the new build
	err = tx.EnvBuild.Create().
		SetID(buildID).
		SetEnvID(templateID).
		SetStatus(envbuild.StatusWaiting).
		SetRAMMB(ramMB).
		SetVcpu(cpuCount).
		SetKernelVersion(schema.DefaultKernelVersion).
		SetFirecrackerVersion(schema.DefaultFirecrackerVersion).
		SetFreeDiskSizeMB(tier.DiskMB).
		SetNillableStartCmd(body.StartCmd).
		SetDockerfile(body.Dockerfile).
		Exec(ctx)

	// Check if the alias is available and claim it
	if alias != "" {
		envs, err := tx.
			Env.
			Query().
			Where(env.ID(alias)).
			All(ctx)
		if err != nil {
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when checking alias: %s", err))

			err = fmt.Errorf("error when checking alias: %w", err)
			telemetry.ReportCriticalError(ctx, err)

			return nil

		}

		if len(envs) > 0 {
			a.sendAPIStoreError(c, http.StatusConflict, "Alias already used")

			err = fmt.Errorf("alias already used: %w", err)
			telemetry.ReportCriticalError(ctx, err)

			return nil
		}

		aliasDB, err := tx.EnvAlias.Query().Where(envalias.ID(alias)).Only(ctx)

		if err != nil {
			if !models.IsNotFound(err) {
				a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when checking alias: %s", err))

				err = fmt.Errorf("error when checking alias: %w", err)
				telemetry.ReportCriticalError(ctx, err)

				return nil

			}

			count, err := tx.EnvAlias.Delete().Where(envalias.EnvID(templateID), envalias.IsRenamable(true)).Exec(ctx)
			if err != nil {
				a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when deleting template alias: %s", err))

				err = fmt.Errorf("error when deleting template alias: %w", err)
				telemetry.ReportCriticalError(ctx, err)

				return nil
			}

			if count > 0 {
				telemetry.ReportEvent(ctx, "deleted old aliases", attribute.Int("env.alias.count", count))
			}

			err = tx.
				EnvAlias.
				Create().
				SetEnvID(templateID).SetIsRenamable(true).SetID(alias).
				Exec(ctx)

			if err != nil {
				a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when inserting alias: %s", err))

				err = fmt.Errorf("error when inserting alias: %w", err)
				telemetry.ReportCriticalError(ctx, err)

				return nil

			}
		} else if aliasDB.EnvID != templateID {
			a.sendAPIStoreError(c, http.StatusForbidden, "Alias already used")

			err = fmt.Errorf("alias already used: %w", err)
			telemetry.ReportCriticalError(ctx, err)

			return nil
		}

		telemetry.ReportEvent(ctx, "inserted alias", attribute.String("env.alias", alias))
	}

	// Commit the transaction
	err = tx.Commit()
	if err != nil {
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Error when committing transaction: %s", err))

		err = fmt.Errorf("error when committing transaction: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return nil
	}

	properties := a.posthog.GetPackageToPosthogProperties(&c.Request.Header)
	a.posthog.IdentifyAnalyticsTeam(team.ID.String(), team.Name)
	a.posthog.CreateAnalyticsUserEvent(userID.String(), team.ID.String(), "submitted environment build request", properties.
		Set("environment", templateID).
		Set("build_id", buildID).
		Set("alias", alias),
	)

	telemetry.SetAttributes(ctx,
		attribute.String("env.alias", alias),
		attribute.Int64("build.cpu_count", cpuCount),
		attribute.Int64("build.ram_mb", ramMB),
	)
	telemetry.ReportEvent(ctx, "started updating environment")

	var aliases []string

	if alias != "" {
		aliases = append(aliases, alias)
	}

	a.logger.Infof("Built template %s with build id %s", templateID, buildID.String())

	return &api.Template{
		TemplateID: templateID,
		BuildID:    buildID.String(),
		Public:     false,
		Aliases:    &aliases,
	}
}

func getCPUAndRAM(tierID string, cpuCount, memoryMB *int) (int64, int64, *api.APIError) {
	cpu := constants.DefaultTemplateCPU
	ramMB := constants.DefaultTemplateMemory

	// Check if team can customize the resources
	if (cpuCount != nil || memoryMB != nil) && tierID == constants.BaseTierID {
		return 0, 0, &api.APIError{
			Err:       fmt.Errorf("team with tier %s can't customize resources", tierID),
			ClientMsg: "Team with this tier can't customize resources, don't specify cpu count or memory",
			Code:      http.StatusBadRequest,
		}
	}

	if cpuCount != nil {
		if *cpuCount < constants.MinTemplateCPU || *cpuCount > constants.MaxTemplateCPU {
			return 0, 0, &api.APIError{
				Err:       fmt.Errorf("customCPU must be between %d and %d", constants.MinTemplateCPU, constants.MaxTemplateCPU),
				ClientMsg: fmt.Sprintf("CPU must be between %d and %d", constants.MinTemplateCPU, constants.MaxTemplateCPU),
				Code:      http.StatusBadRequest,
			}
		}

		cpu = *cpuCount
	}

	if memoryMB != nil {
		if *memoryMB < constants.MinTemplateMemory || *memoryMB > constants.MaxTemplateMemory {
			return 0, 0, &api.APIError{
				Err:       fmt.Errorf("customMemory must be between %d and %d", constants.MinTemplateMemory, constants.MaxTemplateMemory),
				ClientMsg: fmt.Sprintf("Memory must be between %d and %d", constants.MinTemplateMemory, constants.MaxTemplateMemory),
				Code:      http.StatusBadRequest,
			}
		}

		if *memoryMB%2 != 0 {
			return 0, 0, &api.APIError{
				Err:       fmt.Errorf("customMemory must be divisible by 2"),
				ClientMsg: "Memory must be a divisible by 2",
				Code:      http.StatusBadRequest,
			}
		}

		ramMB = *memoryMB
	}

	return int64(cpu), int64(ramMB), nil
}

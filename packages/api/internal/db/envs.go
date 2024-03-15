package db

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envalias"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envbuild"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func (db *DB) DeleteEnv(ctx context.Context, envID string) error {
	_, err := db.
		Client.
		Env.
		Delete().
		Where(env.ID(envID)).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete env '%s': %w", envID, err)
	}

	return nil
}

func (db *DB) GetEnvs(ctx context.Context, teamID uuid.UUID) (result []*api.Template, err error) {
	envs, err := db.
		Client.
		Env.
		Query().
		Where(
			env.Or(env.TeamID(teamID), env.Public(true)),
			env.HasBuildsWith(envbuild.StatusEQ(envbuild.StatusSuccess)),
		).
		Order(models.Asc(env.FieldCreatedAt)).
		WithEnvAliases().
		WithBuilds(func(query *models.EnvBuildQuery) {
			query.Where(envbuild.StatusEQ(envbuild.StatusSuccess)).Order(models.Desc(envbuild.FieldFinishedAt)).Limit(1)
		}).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list envs: %w", err)
	}

	for _, item := range envs {
		aliases := make([]string, len(item.Edges.EnvAliases))
		for i, alias := range item.Edges.EnvAliases {
			aliases[i] = alias.ID
		}

		build := item.Edges.Builds[0]
		result = append(result, &api.Template{
			TemplateID: item.ID,
			BuildID:    build.ID.String(),
			Public:     item.Public,
			Aliases:    &aliases,
		})
	}

	return result, nil
}

var ErrEnvNotFound = fmt.Errorf("env not found")

func (db *DB) GetEnv(ctx context.Context, aliasOrEnvID string, teamID uuid.UUID, canBePublic bool) (result *api.Template, build *models.EnvBuild, err error) {
	dbEnv, err := db.
		Client.
		Env.
		Query().
		Where(
			env.Or(
				env.HasEnvAliasesWith(envalias.ID(aliasOrEnvID)),
				env.ID(aliasOrEnvID),
			),
			env.Or(
				env.TeamID(teamID),
				env.Public(true),
			),
			env.HasBuildsWith(envbuild.StatusEQ(envbuild.StatusSuccess)),
		).
		WithEnvAliases(func(query *models.EnvAliasQuery) {
			query.Order(models.Asc(envalias.FieldID)) // TODO: remove once we have only 1 alias per env
		}).
		WithBuilds(func(query *models.EnvBuildQuery) {
			query.Where(envbuild.StatusEQ(envbuild.StatusSuccess)).Order(models.Desc(envbuild.FieldFinishedAt)).Limit(1)
		}).Only(ctx)

	notFound := models.IsNotFound(err)
	if notFound {
		return nil, nil, ErrEnvNotFound
	} else if err != nil {
		return nil, nil, fmt.Errorf("failed to get env '%s': %w", aliasOrEnvID, err)
	}

	if !canBePublic && dbEnv.TeamID != teamID {
		return nil, nil, fmt.Errorf("you don't have access to this env '%s'", aliasOrEnvID)
	}

	aliases := make([]string, len(dbEnv.Edges.EnvAliases))
	for i, alias := range dbEnv.Edges.EnvAliases {
		aliases[i] = alias.ID
	}

	build = dbEnv.Edges.Builds[0]
	return &api.Template{
		TemplateID: dbEnv.ID,
		BuildID:    build.ID.String(),
		Public:     dbEnv.Public,
		Aliases:    &aliases,
	}, build, nil
}

func (db *DB) UpsertEnv(
	ctx context.Context,
	teamID uuid.UUID,
	envID string,
	buildID uuid.UUID,
	vCPU,
	ramMB,
	freeDiskSizeMB int64,
	kernelVersion,
	firecrackerVersion string,
	startCmd *string,
) error {
	tx, err := db.Client.Tx(ctx)
	if err != nil {
		err = fmt.Errorf("error when starting transaction: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return err
	}
	defer tx.Rollback()

	err = tx.
		Env.
		Create().
		SetID(envID).
		SetTeamID(teamID).
		SetPublic(false).
		OnConflictColumns(env.FieldID).
		UpdateUpdatedAt().
		Update(func(e *models.EnvUpsert) {
			e.AddBuildCount(1)
		}).
		Exec(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to upsert env with id '%s': %w", envID, err)

		return errMsg
	}

	err = tx.EnvBuild.Create().
		SetID(buildID).
		SetEnvID(envID).
		SetStatus(envbuild.StatusWaiting).
		SetRAMMB(ramMB).
		SetVcpu(vCPU).
		SetKernelVersion(kernelVersion).
		SetFirecrackerVersion(firecrackerVersion).
		SetFreeDiskSizeMB(freeDiskSizeMB).
		SetNillableStartCmd(startCmd).
		Exec(ctx)
	err = tx.Commit()
	if err != nil {
		err = fmt.Errorf("error when committing transaction: %w", err)
		telemetry.ReportCriticalError(ctx, err)

		return err
	}

	return nil
}

func (db *DB) FinishEnvBuild(
	ctx context.Context,
	envID string,
	buildID uuid.UUID,
	totalDiskSizeMB int64,
) error {
	err := db.Client.EnvBuild.Update().Where(envbuild.ID(buildID), envbuild.EnvID(envID)).
		SetTotalDiskSizeMB(totalDiskSizeMB).SetStatus(envbuild.StatusSuccess).Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to finish env build '%s': %w", buildID, err)
	}

	return nil
}

func (db *DB) EnvBuildSetStatus(
	ctx context.Context,
	envID string,
	buildID uuid.UUID,
	status envbuild.Status,
) error {
	err := db.Client.EnvBuild.Update().Where(envbuild.ID(buildID), envbuild.EnvID(envID)).
		SetStatus(status).Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to finish env build '%s': %w", buildID, err)
	}

	return nil
}

func (db *DB) HasEnvAccess(ctx context.Context, aliasOrEnvID string, teamID uuid.UUID, canBePublic bool) (env *api.Template, build *models.EnvBuild, err error) {
	envDB, build, err := db.GetEnv(ctx, aliasOrEnvID, teamID, canBePublic)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get env '%s': %w", aliasOrEnvID, err)
	}

	return envDB, build, nil
}

func (db *DB) UpdateEnvLastUsed(ctx context.Context, envID string) (err error) {
	return db.Client.Env.UpdateOneID(envID).AddSpawnCount(1).SetLastSpawnedAt(time.Now()).Exec(ctx)
}

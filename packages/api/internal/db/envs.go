package db

import (
	"context"
	"fmt"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envalias"

	"github.com/google/uuid"
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
		Where(env.Or(env.TeamID(teamID), env.Public(true))).
		Order(models.Asc(env.FieldCreatedAt)).
		WithEnvAliases().
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list envs: %w", err)
	}

	for _, item := range envs {
		aliases := make([]string, len(item.Edges.EnvAliases))
		for i, alias := range item.Edges.EnvAliases {
			aliases[i] = alias.ID
		}

		result = append(result, &api.Template{
			TemplateID: item.ID,
			BuildID:    item.BuildID.String(),
			Public:     item.Public,
			Aliases:    &aliases,
		})
	}

	return result, nil
}

var ErrEnvNotFound = fmt.Errorf("env not found")

func (db *DB) GetEnv(ctx context.Context, aliasOrEnvID string, teamID uuid.UUID, canBePublic bool) (result *api.Environment, err error) {
	dbEnv, err := db.
		Client.
		Env.
		Query().
		Where(env.Or(env.HasEnvAliasesWith(envalias.ID(aliasOrEnvID)), env.ID(aliasOrEnvID)), env.Or(env.TeamID(teamID), env.Public(true))).
		WithEnvAliases(func(query *models.EnvAliasQuery) {
			query.Order(models.Asc(envalias.FieldID)) // TODO: remove once we have only 1 alias per env
		}).
		Only(ctx)

	notFound := models.IsNotFound(err)
	if notFound {
		return nil, ErrEnvNotFound
	} else if err != nil {
		return nil, fmt.Errorf("failed to get env '%s': %w", aliasOrEnvID, err)
	}

	if !canBePublic && dbEnv.TeamID != teamID {
		return nil, fmt.Errorf("you don't have access to this env '%s'", aliasOrEnvID)
	}

	aliases := make([]string, len(dbEnv.Edges.EnvAliases))
	for i, alias := range dbEnv.Edges.EnvAliases {
		aliases[i] = alias.ID
	}

	return &api.Environment{
		EnvID:   dbEnv.ID,
		BuildID: dbEnv.BuildID.String(),
		Public:  dbEnv.Public,
		Aliases: &aliases,
	}, nil
}

func (db *DB) UpsertEnv(ctx context.Context, teamID uuid.UUID, envID string, buildID uuid.UUID, dockerfile string, vCPU, ramMB, freeDiskSizeMB, totalDiskSizeMB int64) error {
	err := db.
		Client.
		Env.
		Create().
		SetID(envID).
		SetBuildID(buildID).
		SetTeamID(teamID).
		SetDockerfile(dockerfile).
		SetPublic(false).
		SetRAMMB(ramMB).
		SetVcpu(vCPU).
		SetFreeDiskSizeMB(freeDiskSizeMB).
		SetTotalDiskSizeMB(totalDiskSizeMB).
		OnConflictColumns(env.FieldID).
		UpdateBuildID().
		UpdateDockerfile().
		UpdateUpdatedAt().
		UpdateVcpu().
		UpdateRAMMB().
		UpdateFreeDiskSizeMB().
		UpdateTotalDiskSizeMB().
		Update(func(e *models.EnvUpsert) {
			e.AddBuildCount(1)
		}).
		Exec(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to upsert env with id '%s': %w", envID, err)

		fmt.Println(errMsg.Error())

		return errMsg
	}

	return nil
}

func (db *DB) HasEnvAccess(ctx context.Context, aliasOrEnvID string, teamID uuid.UUID, canBePublic bool) (env *api.Environment, hasAccess bool, err error) {
	envDB, err := db.GetEnv(ctx, aliasOrEnvID, teamID, canBePublic)
	if err != nil {
		return nil, false, fmt.Errorf("failed to get env '%s': %w", aliasOrEnvID, err)
	}

	return envDB, true, nil
}

func (db *DB) UpdateEnvLastUsed(ctx context.Context, envID string) (err error) {
	return db.Client.Env.UpdateOneID(envID).AddSpawnCount(1).SetLastSpawnedAt(time.Now()).Exec(ctx)
}

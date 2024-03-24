package db

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envalias"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envbuild"
)

type Template struct {
	TemplateID string
	BuildID    string
	VCPU       int64
	DiskMB     int64
	RAMMB      int64
	Public     bool
	Aliases    *[]string
}

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

func (db *DB) GetEnvs(ctx context.Context, teamID uuid.UUID) (result []*Template, err error) {
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
			query.Where(envbuild.StatusEQ(envbuild.StatusSuccess)).Order(models.Desc(envbuild.FieldFinishedAt))
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
		result = append(result, &Template{
			TemplateID: item.ID,
			BuildID:    build.ID.String(),
			VCPU:       build.Vcpu,
			RAMMB:      build.RAMMB,
			DiskMB:     build.FreeDiskSizeMB,
			Public:     item.Public,
			Aliases:    &aliases,
		})
	}

	return result, nil
}

var ErrEnvNotFound = fmt.Errorf("env not found")

func (db *DB) GetEnv(ctx context.Context, aliasOrEnvID string, teamID uuid.UUID, canBePublic bool) (result *Template, build *models.EnvBuild, err error) {
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
	return &Template{
		TemplateID: dbEnv.ID,
		BuildID:    build.ID.String(),
		VCPU:       build.Vcpu,
		RAMMB:      build.RAMMB,
		DiskMB:     build.FreeDiskSizeMB,
		Public:     dbEnv.Public,
		Aliases:    &aliases,
	}, build, nil
}

func (db *DB) FinishEnvBuild(
	ctx context.Context,
	envID string,
	buildID uuid.UUID,
	totalDiskSizeMB int64,
) error {
	err := db.Client.EnvBuild.Update().Where(envbuild.ID(buildID), envbuild.EnvID(envID)).
		SetFinishedAt(time.Now()).
		SetTotalDiskSizeMB(totalDiskSizeMB).
		SetStatus(envbuild.StatusSuccess).
		Exec(ctx)
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
		SetStatus(status).SetFinishedAt(time.Now()).Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to finish env build '%s': %w", buildID, err)
	}

	return nil
}

func (db *DB) UpdateEnvLastUsed(ctx context.Context, envID string) (err error) {
	return db.Client.Env.UpdateOneID(envID).AddSpawnCount(1).SetLastSpawnedAt(time.Now()).Exec(ctx)
}

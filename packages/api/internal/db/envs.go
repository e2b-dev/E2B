package db

import (
	"context"
	"fmt"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/env"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/envalias"

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

func (db *DB) GetEnvs(ctx context.Context, teamID uuid.UUID) (result []*api.Environment, err error) {
	envs, err := db.
		Client.
		Env.
		Query().
		Where(env.Or(env.TeamID(teamID), env.Public(true))).
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

		result = append(result, &api.Environment{
			EnvID:   item.ID,
			BuildID: item.BuildID.String(),
			Public:  item.Public,
			Aliases: &aliases,
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
		WithEnvAliases().
		Only(ctx)

	notFound := ent.IsNotFound(err)
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

func (db *DB) UpsertEnv(ctx context.Context, teamID uuid.UUID, envID string, buildID uuid.UUID, dockerfile string) error {
	err := db.
		Client.
		Env.
		Create().
		SetID(envID).
		SetBuildID(buildID).
		SetTeamID(teamID).
		SetDockerfile(dockerfile).
		SetPublic(false).
		OnConflictColumns(env.FieldID).
		UpdateBuildID().
		UpdateDockerfile().
		UpdateUpdatedAt().
		Update(func(e *ent.EnvUpsert) {
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

func (db *DB) HasEnvAccess(ctx context.Context, aliasOrEnvID string, teamID uuid.UUID, canBePublic bool) (string, bool, error) {
	env, err := db.GetEnv(ctx, aliasOrEnvID, teamID, canBePublic)
	if err != nil {
		return "", false, fmt.Errorf("failed to get env '%s': %w", aliasOrEnvID, err)
	}

	return env.EnvID, true, nil
}

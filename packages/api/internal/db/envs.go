package db

import (
	"fmt"
	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/env"
	"github.com/google/uuid"
)

func (db *DB) DeleteEnv(envID string) error {
	_, err := db.Client.Env.Delete().Where(env.ID(envID)).Exec(db.ctx)
	if err != nil {
		return fmt.Errorf("failed to delete env '%s': %w", envID, err)
	}

	return nil
}

func (db *DB) GetEnvs(teamID string) (result []*api.Environment, err error) {
	//publicWhere := models.EnvWhere.Public.EQ(true)
	//teamWhere := models.EnvWhere.TeamID.EQ(teamID)
	//
	//envs, err := models.Envs(publicWhere, qm.Or2(teamWhere)).All(db.Client)
	id, err := uuid.Parse(teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to parse teamID: %w", err)
	}

	envs, err := db.Client.Env.Query().Where(env.Or(env.TeamID(id), env.Public(true))).All(db.ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list envs: %w", err)
	}

	for _, item := range envs {
		result = append(result, &api.Environment{
			EnvID:   item.ID,
			BuildID: item.BuildID.String(),
			Public:  item.Public,
		})
	}

	return result, nil
}

var ErrEnvNotFound = fmt.Errorf("env not found")

func (db *DB) GetEnv(envID string, teamID string) (result *api.Environment, err error) {
	id, err := uuid.Parse(teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to parse teamID: %w", err)
	}

	dbEnv, err := db.Client.Env.Query().Where(env.Or(env.ID(envID), env.Public(true)), env.TeamID(id)).Only(db.ctx)

	if err != nil {
		return nil, ErrEnvNotFound
	}

	return &api.Environment{
		EnvID:   dbEnv.ID,
		BuildID: dbEnv.BuildID.String(),
		Public:  dbEnv.Public,
	}, nil
}

func (db *DB) UpsertEnv(teamID, envID, buildID, dockerfile string) error {
	teamUUID, err := uuid.Parse(teamID)
	if err != nil {
		return fmt.Errorf("failed to parse teamID: %w", err)
	}

	buildUUID, err := uuid.Parse(buildID)
	if err != nil {
		return fmt.Errorf("failed to parse teamID: %w", err)
	}

	err = db.Client.Env.Create().SetID(envID).SetBuildID(buildUUID).SetTeamID(teamUUID).SetDockerfile(dockerfile).SetPublic(false).
		OnConflictColumns(env.FieldID).
		UpdateBuildID().UpdateDockerfile().
		Exec(db.ctx)

	if err != nil {
		errMsg := fmt.Errorf("failed to upsert env with id '%s': %w", envID, err)

		fmt.Println(errMsg.Error())

		return errMsg
	}

	return nil
}

func (db *DB) HasEnvAccess(envID string, teamID string, public bool) (bool, error) {
	e, err := db.GetEnv(envID, teamID)
	if err != nil {
		return false, fmt.Errorf("failed to get env '%s': %w", envID, err)
	}

	if !public && e.Public {
		return false, nil
	}

	return true, nil
}

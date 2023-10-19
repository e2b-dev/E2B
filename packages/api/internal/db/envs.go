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
			BuildID: "",
			Status:  api.EnvironmentStatus(item.Status),
			Public:  item.Public,
			Logs:    nil,
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
		return nil, fmt.Errorf("failed to get env: %w", err)
	}

	return &api.Environment{
		EnvID:   dbEnv.ID,
		BuildID: "",
		Status:  api.EnvironmentStatus(dbEnv.Status),
		Logs:    nil,
		Public:  dbEnv.Public,
	}, nil
}

func (db *DB) CreateEnv(envID string, teamID string, dockerfile string) (*api.Environment, error) {
	id, err := uuid.Parse(teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to parse teamID: %w", err)
	}

	e, err := db.Client.Env.Create().SetID(envID).SetTeamID(id).SetStatus(env.StatusBuilding).SetDockerfile(dockerfile).SetPublic(false).Save(db.ctx)

	if err != nil {
		errMsg := fmt.Errorf("failed to create env with id '%s' with Dockerfile '%s': %w", envID, dockerfile, err)

		fmt.Println(errMsg.Error())

		return nil, errMsg
	}

	return &api.Environment{
		EnvID:   e.ID,
		BuildID: "",
		Status:  api.EnvironmentStatus(e.Status),
		Logs:    nil,
		Public:  e.Public,
	}, nil
}

func (db *DB) UpdateDockerfileEnv(envID string, dockerfile string) (*api.Environment, error) {
	e, err := db.Client.Env.UpdateOneID(envID).SetDockerfile(dockerfile).Save(db.ctx)

	if err != nil {
		errMsg := fmt.Errorf("failed to update env with id '%s' with Dockerfile '%s': %w", envID, dockerfile, err)

		fmt.Println(errMsg.Error())

		return nil, errMsg
	}

	return &api.Environment{EnvID: e.ID, BuildID: "", Logs: nil, Status: api.EnvironmentStatusBuilding, Public: e.Public}, nil
}

func (db *DB) UpdateStatusEnv(envID string, status env.Status) (*api.Environment, error) {
	e, err := db.Client.Env.UpdateOneID(envID).SetStatus(status).Save(db.ctx)

	if err != nil {
		errMsg := fmt.Errorf("failed to update env with id '%s' with status '%s': %w", envID, status, err)

		fmt.Println(errMsg.Error())

		return nil, errMsg
	}

	return &api.Environment{EnvID: e.ID, BuildID: "", Logs: nil, Status: api.EnvironmentStatus(e.Status), Public: e.Public}, nil
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

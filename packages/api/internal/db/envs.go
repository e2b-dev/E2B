package db

import (
	"fmt"
	"github.com/volatiletech/sqlboiler/v4/queries/qm"

	"github.com/e2b-dev/api/packages/api/internal/api"
	"github.com/e2b-dev/api/packages/api/internal/db/models"
	"github.com/volatiletech/sqlboiler/v4/boil"
)

func (db *DB) DeleteEnv(envID string) error {
	_, err := models.Envs(models.EnvWhere.ID.EQ(envID)).DeleteAll(db.Client)

	if err != nil {
		return fmt.Errorf("failed to delete env '%s': %w", envID, err)
	}

	return nil
}

func (db *DB) GetEnvs(teamID string) (result []*api.Environment, err error) {
	publicWhere := models.EnvWhere.Public.EQ(true)
	teamWhere := models.EnvWhere.TeamID.EQ(teamID)
	envs, err := models.Envs(publicWhere, qm.Or2(teamWhere)).All(db.Client)

	if err != nil {
		return nil, fmt.Errorf("failed to list envs: %w", err)
	}

	for _, env := range envs {
		result = append(result, &api.Environment{
			EnvID:  env.ID,
			Status: api.EnvironmentStatus(env.Status),
			Public: env.Public,
		})
	}

	return result, nil
}

func (db *DB) GetEnv(envID string, teamID string) (env *api.Environment, err error) {
	publicWhere := models.EnvWhere.Public.EQ(true)
	teamWhere := models.EnvWhere.TeamID.EQ(teamID)
	envWhere := models.EnvWhere.ID.EQ(envID)
	dbEnvs, err := models.Envs(qm.Expr(publicWhere, qm.Or2(teamWhere)), envWhere).All(db.Client)

	if err != nil {
		return nil, fmt.Errorf("failed to list envs: %w", err)
	}

	if len(dbEnvs) == 0 {
		return nil, nil
	}

	dbEnv := dbEnvs[0]
	return &api.Environment{
		EnvID:  dbEnv.ID,
		Status: api.EnvironmentStatus(dbEnv.Status),
		Public: dbEnv.Public,
	}, nil
}

func (db *DB) CreateEnv(envID string, teamID string, dockerfile string) (*api.Environment, error) {
	// trunk-ignore(golangci-lint/exhaustruct)
	env := &models.Env{
		ID:         envID,
		TeamID:     teamID,
		Dockerfile: dockerfile,
		Public:     false,
	}
	err := env.Insert(db.Client, boil.Infer())

	if err != nil {
		fmt.Printf("error: %v\n", err)

		return nil, fmt.Errorf("failed to create env with id '%s' with Dockerfile '%s': %w", envID, dockerfile, err)
	}

	return &api.Environment{EnvID: envID, Status: api.EnvironmentStatusBuilding, Public: false}, nil
}

func (db *DB) UpdateDockerfileEnv(envID string, dockerfile string) (*api.Environment, error) {
	// trunk-ignore(golangci-lint/exhaustruct)
	env := &models.Env{
		ID:         envID,
		Dockerfile: dockerfile,
		Public:     false,
		Status:     models.EnvStatusEnumBuilding,
	}
	rowsAffected, err := env.Update(db.Client, boil.Whitelist("status", "dockerfile"))

	if err != nil {
		fmt.Printf("error: %v\n", err)

		return nil, fmt.Errorf("failed to update env with id '%s' with Dockerfile '%s': %w", envID, dockerfile, err)
	}

	if rowsAffected == 0 {
		return nil, fmt.Errorf("didn't find env to update, env with id '%s'", envID)
	}

	return &api.Environment{EnvID: envID, Status: api.EnvironmentStatusBuilding, Public: false}, nil
}

func (db *DB) UpdateStatusEnv(envID string, status models.EnvStatusEnum) (*api.Environment, error) {
	// trunk-ignore(golangci-lint/exhaustruct)
	env := &models.Env{
		ID:     envID,
		Status: status,
	}
	rowsAffected, err := env.Update(db.Client, boil.Whitelist("status"))

	if err != nil {
		fmt.Printf("error: %v\n", err)

		return nil, fmt.Errorf("failed to update env with id '%s': %w", envID, err)
	}

	if rowsAffected == 0 {
		return nil, fmt.Errorf("didn't find env to update to, env with id '%s'", envID)
	}

	return &api.Environment{EnvID: envID, Status: api.EnvironmentStatus(status), Public: false}, nil
}

func (db *DB) HasEnvAccess(envID string, teamID string, public bool) (bool, error) {
	env, err := db.GetEnv(envID, teamID)

	if err != nil {
		return false, fmt.Errorf("failed to get env '%s': %w", envID, err)
	}

	if env == nil || !public && env.Public {
		return false, nil
	}

	return env != nil, err
}

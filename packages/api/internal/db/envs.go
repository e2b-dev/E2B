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
	dbEnv, err := models.Envs(qm.Expr(publicWhere, qm.Or2(teamWhere)), envWhere).One(db.Client)
	if err != nil {

		return nil, fmt.Errorf("failed to list envs: %w", err)
	}

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

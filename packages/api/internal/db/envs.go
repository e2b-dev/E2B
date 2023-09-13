package db

import (
	"fmt"

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

func (db *DB) GetEnvs() (result []*api.Environment, err error) {
	envs, err := models.Envs().All(db.Client)
	if err != nil {

		return nil, fmt.Errorf("failed to list envs: %w", err)
	}

	for _, env := range envs {
		result = append(result, &api.Environment{
			EnvID: env.ID,
		})
	}

	return result, nil
}

type newEnv struct {
	ID string `json:"id"`
}

func (db *DB) CreateEnv(envID string, teamID string, dockerfile string) (*newEnv, error) {
	// trunk-ignore(golangci-lint/exhaustruct)
	env := &models.Env{
		ID:         envID,
		TeamID:     teamID,
		Dockerfile: dockerfile,
	}
	err := env.Insert(db.Client, boil.Infer())

	if err != nil {
		fmt.Printf("error: %v\n", err)

		return nil, fmt.Errorf("failed to create env with id '%s' with Dockerfile '%s': %w", envID, dockerfile, err)
	}

	return &newEnv{envID}, nil
}

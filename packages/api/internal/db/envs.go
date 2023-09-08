package db

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/e2b-dev/api/packages/api/internal/api"
	"github.com/e2b-dev/api/packages/api/internal/utils"
)

const envsTableName = "envs"

func (db *DB) DeleteEnv(envID string) error {
	err := db.Client.
		From(envsTableName).
		Delete().
		Eq("id", envID).
		Execute(nil)
	if err != nil {
		var jsonSyntaxErr *json.SyntaxError
		if errors.As(err, &jsonSyntaxErr) {
			fmt.Printf("syntax error at byte offset %d", jsonSyntaxErr.Offset)
		}

		fmt.Printf("error: %v\n", err)

		return fmt.Errorf("failed to delete env '%s': %w", envID, err)
	}

	return nil
}

func (db *DB) GetEnvs() (result []*api.Environment, err error) {
	err = db.Client.
		From(envsTableName).
		Select("*").
		Execute(result)
	if err != nil {
		var jsonSyntaxErr *json.SyntaxError
		if errors.As(err, &jsonSyntaxErr) {
			fmt.Printf("syntax error at byte offset %d", jsonSyntaxErr.Offset)
		}

		fmt.Printf("error: %v\n", err)

		return nil, fmt.Errorf("failed to list envs: %w", err)
	}

	return result, nil
}

type newEnv struct {
	BuildConfig *api.BuildConfig `json:"build_config"`
	ID          string           `json:"id"`
}

func (db *DB) CreateEnv(buildConfig *api.BuildConfig) (*newEnv, error) {
	envID := utils.GenerateID()

	body := newEnv{
		ID:          envID,
		BuildConfig: buildConfig,
	}

	err := db.Client.
		From(envsTableName).
		Insert(&body).
		Execute(nil)
	if err != nil {
		var jsonSyntaxErr *json.SyntaxError
		if errors.As(err, &jsonSyntaxErr) {
			fmt.Printf("syntax error at byte offset %d", jsonSyntaxErr.Offset)
		}

		fmt.Printf("error: %v\n", err)

		return nil, fmt.Errorf("failed to create env with id '%s' with build config '%s': %w", envID, buildConfig, err)
	}

	return &body, nil
}

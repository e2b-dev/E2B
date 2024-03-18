package db

import (
	"context"
	"fmt"

	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envalias"
)

func (db *DB) DeleteEnvAlias(ctx context.Context, alias string) error {
	err := db.
		Client.
		EnvAlias.
		DeleteOneID(alias).
		Exec(ctx)

	if err != nil {
		errMsg := fmt.Errorf("failed to delete env alias '%s': %w", alias, err)

		return errMsg
	}

	return nil
}

func (db *DB) reserveEnvAlias(ctx context.Context, envID, alias string) error {
	err := db.
		Client.
		EnvAlias.
		Create().
		SetID(alias).
		SetEnvID(envID).
		Exec(ctx)

	if err != nil {
		errMsg := fmt.Errorf("failed to reserve env alias '%s': %w", alias, err)

		return errMsg
	}

	return nil
}

// rollback calls to tx.Rollback and wraps the given error
// with the rollback error if occurred.
func rollback(tx *models.Tx, err error) error {
	if rerr := tx.Rollback(); rerr != nil {
		err = fmt.Errorf("%w: %w", err, rerr)
	}

	return err
}

func (db *DB) UpdateEnvAlias(ctx context.Context, alias, envID string) error {
	tx, err := db.Client.Tx(ctx)
	if err != nil {
		return fmt.Errorf("starting a transaction: %w", err)
	}

	_, err = tx.
		EnvAlias.
		Delete().
		Where(
			envalias.EnvID(envID),
			envalias.IsRenameable(true)).
		Exec(ctx)

	if err != nil {
		errMsg := fmt.Errorf("failed to delete env alias '%s' for env '%s': %w", alias, envID, err)

		return rollback(tx, errMsg)
	}

	err = tx.
		EnvAlias.
		Create().
		SetID(alias).
		SetEnvID(envID).
		Exec(ctx)

	if err != nil {
		errMsg := fmt.Errorf("failed to update env alias '%s' for env '%s': %w", alias, envID, err)

		return rollback(tx, errMsg)
	}

	err = tx.Commit()

	if err != nil {
		errMsg := fmt.Errorf("committing transaction: %w", err)

		return errMsg
	}

	return nil
}

func (db *DB) EnsureEnvAlias(ctx context.Context, alias, envID string) error {
	envs, err := db.
		Client.
		Env.
		Query().
		Where(env.ID(alias)).
		All(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to get env '%s': %w", alias, err)

		return errMsg
	}

	if len(envs) > 0 {
		errMsg := fmt.Errorf("alias '%s' is already used for an another env", alias)

		return errMsg
	}

	aliasDB, err := db.Client.EnvAlias.Query().Where(envalias.ID(alias)).Only(ctx)

	if err != nil {
		if !models.IsNotFound(err) {
			errMsg := fmt.Errorf("failed to get env alias '%s': %w", alias, err)

			return errMsg
		}
		err = db.
			Client.
			EnvAlias.
			Create().
			SetEnvID(envID).SetIsRenameable(true).SetID(alias).
			Exec(ctx)

		if err != nil {
			errMsg := fmt.Errorf("failed to create env alias '%s': %w", envID, err)

			return errMsg
		}
		if aliasDB.EnvID != envID {
			errMsg := fmt.Errorf("alias '%s' is already used", alias)

			return errMsg
		}
	}

	return nil
}

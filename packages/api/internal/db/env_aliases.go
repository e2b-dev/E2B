package db

import (
	"context"
	"fmt"

	"github.com/e2b-dev/infra/packages/api/internal/db/ent"
)

func (db *DB) DeleteEnvAlias(ctx context.Context, alias string) error {
	err := db.
		Client.
		EnvAlias.
		DeleteOneID(alias).
		Exec(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to delete env alias '%s': %w", alias, err)

		fmt.Println(errMsg.Error())

		return errMsg
	}

	return nil
}

func (db *DB) ReserveEnvAlias(ctx context.Context, alias string) error {
	err := db.
		Client.
		EnvAlias.
		Create().
		SetID(alias).
		SetNillableEnvID(nil).
		Exec(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to reserve env alias '%s': %w", alias, err)

		fmt.Println(errMsg.Error())

		return errMsg
	}

	return nil
}

func (db *DB) UpdateEnvAlias(ctx context.Context, alias, envID string) error {
	err := db.
		Client.
		EnvAlias.
		UpdateOneID(alias).
		SetEnvID(envID).
		Exec(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to upsert env alias '%s' for env '%s': %w", alias, envID, err)

		fmt.Println(errMsg.Error())

		return errMsg
	}

	return nil
}

// rollback calls to tx.Rollback and wraps the given error
// with the rollback error if occurred.
func rollback(tx *ent.Tx, err error) error {
	if rerr := tx.Rollback(); rerr != nil {
		err = fmt.Errorf("%w: %w", err, rerr)
	}

	return err
}

func (db *DB) UpdateEnvAliasID(ctx context.Context, alias, envID string) error {
	tx, err := db.Client.Tx(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to start transaction: %w", err)

		fmt.Println(errMsg.Error())

		return errMsg
	}

	err = tx.
		EnvAlias.
		Create().
		SetID(alias).
		SetEnvID(envID).
		Exec(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to upsert env alias '%s' for env '%s': %w", alias, envID, err)

		fmt.Println(errMsg.Error())

		return rollback(tx, errMsg)
	}

	return nil
}

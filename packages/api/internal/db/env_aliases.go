package db

import (
	"context"
	"fmt"

	"github.com/e2b-dev/infra/packages/shared/pkg/models"
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

		fmt.Println(errMsg.Error())

		return errMsg
	}

	return nil
}

func (db *DB) DeleteNilEnvAlias(ctx context.Context, alias string) error {
	err := db.
		Client.
		EnvAlias.
		DeleteOneID(alias).
		Where(envalias.EnvIDIsNil()).
		Exec(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to delete env alias '%s': %w", alias, err)

		fmt.Println(errMsg.Error())

		return errMsg
	}

	return nil
}

func (db *DB) reserveEnvAlias(ctx context.Context, alias string) error {
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
		Where(envalias.Or(
			envalias.EnvID(envID),
			envalias.And(envalias.EnvIDIsNil(), envalias.ID(alias)),
		), envalias.IsName(true)).
		Exec(ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to delete env alias '%s' for env '%s': %w", alias, envID, err)

		fmt.Println(errMsg.Error())

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

		fmt.Println(errMsg.Error())

		return rollback(tx, errMsg)
	}

	err = tx.Commit()
	if err != nil {
		errMsg := fmt.Errorf("committing transaction: %w", err)

		fmt.Println(errMsg.Error())

		return errMsg
	}

	return nil
}

func (db *DB) EnsureEnvAlias(ctx context.Context, alias, envID string) error {
	_, err := db.
		Client.
		EnvAlias.
		Query().
		Where(envalias.EnvID(envID), envalias.IsName(true), envalias.ID(alias)).
		Only(ctx)

	notFound := models.IsNotFound(err)
	if notFound {
		err = db.reserveEnvAlias(ctx, alias)
		if err != nil {
			return err
		}
	} else if err != nil {
		errMsg := fmt.Errorf("failed to get env alias '%s': %w", envID, err)

		fmt.Println(errMsg.Error())

		return errMsg
	}

	return nil
}

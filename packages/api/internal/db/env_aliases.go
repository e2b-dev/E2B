package db

import (
	"context"
	"fmt"

	"github.com/e2b-dev/infra/packages/api/internal/db/ent"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/envalias"
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

func (db *DB) EnsureEnvAlias(ctx context.Context, alias, envID string) error {
	_, err := db.
		Client.
		EnvAlias.
		Query().
		Where(envalias.EnvID(envID), envalias.IsName(true)).
		Only(ctx)

	ok := ent.IsNotFound(err)
	if ok {
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

package db

import (
	"fmt"
)

func (db *DB) DeleteEnvAlias(alias string) error {
	err := db.
		Client.
		EnvAlias.
		DeleteOneID(alias).
		Exec(db.ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to delete env alias '%s': %w", alias, err)

		fmt.Println(errMsg.Error())

		return errMsg
	}

	return nil
}

func (db *DB) InsertEnvAlias(alias, envID string) error {
	err := db.
		Client.
		EnvAlias.
		Create().
		SetID(alias).
		SetEnvID(envID).
		Exec(db.ctx)
	if err != nil {
		errMsg := fmt.Errorf("failed to upsert env alias '%s' for env '%s': %w", alias, envID, err)

		fmt.Println(errMsg.Error())

		return errMsg
	}

	return nil
}

package db

import (
	"database/sql"
	"fmt"
	"os"

	"github.com/volatiletech/sqlboiler/v4/boil"
	_ "github.com/volatiletech/sqlboiler/v4/drivers/sqlboiler-psql/driver"
)

type DB struct {
	Client *sql.DB
}

var (
	databaseURL = os.Getenv("DATABASE_CONNECTION_STRING")
)

func NewClient() (*DB, error) {
	db, err := sql.Open("postgres", databaseURL)

	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	boil.SetDB(db)

	return &DB{
		Client: db,
	}, nil
}

func (db *DB) Close() {
	_ = db.Client.Close()
}

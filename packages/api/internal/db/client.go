package db

import (
	"context"
	"fmt"
	"os"

	"github.com/e2b-dev/infra/packages/api/internal/db/ent"

	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/sql"
	_ "github.com/lib/pq"
)

type DB struct {
	Client *ent.Client
	ctx    context.Context
}

var databaseURL = os.Getenv("SUPABASE_CONNECTION_STRING")

func NewClient(ctx context.Context) (*DB, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("database URL is empty")
	}

	drv, err := sql.Open(dialect.Postgres, databaseURL)
	if err != nil {
		return nil, err
	}

	// Get the underlying sql.DB object of the driver.
	db := drv.DB()
	db.SetMaxOpenConns(20)

	client := ent.NewClient(ent.Driver(drv))

	return &DB{Client: client, ctx: ctx}, nil
}

func (db *DB) Close() {
	_ = db.Client.Close()
}

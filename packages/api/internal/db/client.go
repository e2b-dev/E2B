package db

import (
	"context"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/sql"
	"fmt"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent"
	_ "github.com/lib/pq"
	"os"
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

	client := ent.NewClient(ent.Driver(drv), ent.AlternateSchema(ent.SchemaConfig{
		User: "auth",
	}))

	if err != nil {
		err = fmt.Errorf("failed to connect to database: %w", err)
		return nil, err
	}

	return &DB{Client: client, ctx: ctx}, nil
}

func (db *DB) Close() {
	_ = db.Client.Close()
}

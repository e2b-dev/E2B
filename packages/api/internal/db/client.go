package db

import (
	"context"
	"entgo.io/ent/dialect"
	"fmt"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent"
	"os"

	_ "github.com/volatiletech/sqlboiler/v4/drivers/sqlboiler-psql/driver"
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

	client, err := ent.Open(dialect.Postgres, databaseURL, ent.Debug(), ent.AlternateSchema(ent.SchemaConfig{
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

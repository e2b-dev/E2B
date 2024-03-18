package db

import (
	"context"
	"fmt"
	"os"

	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/sql"
	_ "github.com/lib/pq"

	"github.com/e2b-dev/infra/packages/shared/pkg/models"
)

type DB struct {
	Client *models.Client
	ctx    context.Context
}

var databaseURL = os.Getenv("POSTGRES_CONNECTION_STRING")

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

	client := models.NewClient(models.Driver(drv))

	return &DB{Client: client, ctx: ctx}, nil
}

func (db *DB) Close() {
	_ = db.Client.Close()
}

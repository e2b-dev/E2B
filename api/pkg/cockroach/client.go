package cockroach

import (
	"context"
	"fmt"

	//"github.com/cockroachdb/cockroach-go/v2/crdb/crdbpgx"
	//"github.com/google/uuid"
	"github.com/jackc/pgx/v4/pgxpool"
)

const (
	user     = "mlejva"
	password = "ehQuYPk5CE1KXQ9PHYOfaA"
)

type Client struct {
	pool *pgxpool.Pool
}

func databaseURL(databaseID string) string {
	return fmt.Sprintf(
		"postgresql://%s:%s@free-tier5.gcp-europe-west1.cockroachlabs.cloud:26257/%s?sslmode=verify-full&options=--cluster=thick-cow-4620",
		user,
		password,
		databaseID,
	)
}

func NewClient() (*Client, error) {
	dsn := fmt.Sprintf(
		"postgresql://%s:%s@free-tier5.gcp-europe-west1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full&options=--cluster=thick-cow-4620",
		user,
		password,
	)

	pool, err := pgxpool.Connect(context.Background(), dsn)
	if err != nil {
		return nil, err
	}

	return &Client{
		pool: pool,
	}, nil
}

func (c *Client) Close() {
	c.pool.Close()
}

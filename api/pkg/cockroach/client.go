package cockroach

import (
	"context"
	"fmt"

	//"github.com/cockroachdb/cockroach-go/v2/crdb/crdbpgx"
	//"github.com/google/uuid"
	"github.com/jackc/pgx/v4"
)

const (
	user      = "mlejva"
	password  = "ehQuYPk5CE1KXQ9PHYOfaA"
	defaultdb = "defaultdb"
)

type Client struct {
	conn *pgx.Conn
}

func databaseURL(databaseID string) string {
	return fmt.Sprintf(
		"postgresql://%s:%s@free-tier5.gcp-europe-west1.cockroachlabs.cloud:26257/%s?sslmode=verify-full&options=--cluster%3Dthick-cow-4620",
		user,
		password,
		databaseID,
	)
}

func NewClient() (*Client, error) {
	connString := databaseURL(defaultdb)
	config, err := pgx.ParseConfig(connString)
	if err != nil {
		return nil, err
	}

	conn, err := pgx.ConnectConfig(context.Background(), config)
	if err != nil {
		return nil, err
	}

	return &Client{
		conn: conn,
	}, nil
}

package cockroach

import (
	"context"
	"fmt"
	"math/rand"

	"github.com/cockroachdb/cockroach-go/v2/crdb/crdbpgx"
	"github.com/jackc/pgx/v4"
)

var idAlphabet = []rune("abcdefghijklmnopqrstuvwxyz1234567890")

func genRandomID(length int) string {
	b := make([]rune, length)
	for i := range b {
		b[i] = idAlphabet[rand.Intn(len(idAlphabet))]
	}
	return string(b)
}

func (c *Client) createDatabase(ctx context.Context, tx pgx.Tx, id string) error {
	_, err := tx.Exec(
		ctx,
		fmt.Sprintf("CREATE DATABASE %s", id),
	)
	return err
}

func (c *Client) CreateDatabase(ctx context.Context) (string, error) {
	id := genRandomID(8)
	err := crdbpgx.ExecuteTx(ctx, c.conn, pgx.TxOptions{}, func(tx pgx.Tx) error {
		return c.createDatabase(ctx, tx, id)
	})

	if err != nil {
		return "", err
	}
	return databaseURL(id), nil
}

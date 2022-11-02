package cockroach

import (
	"context"
	"fmt"
	"log"
	"math/rand"

	"github.com/jackc/pgx/v4/pgxpool"
)

const (
	//dbCluster = "thick-cow-4620"
	//dbUser     = "mlejva"
	//dbPassword = "ehQuYPk5CE1KXQ9PHYOfaA"

	//dbCluster = "vale-coyote-5017"
	//dbCluster = "floaty-owl-5201"
	// dbCluster = "chilly-rat-5380"
	//dbCluster = "abyss-avocet-5617"
	//dbRegion  = "gcp-europe-west1"

	//dbUser = "dbk"
	//dbPassword = "WajNf9RcgqFp8_aOdybuqg"
	//dbPassword = "fSt3ahMLf2i2sVnG9BNhqA"
	// dbPassword = "ZtjYFXwlNGj5vJqQfMQ3OQ"
	//dbPassword = "uMJ9g-Tapq37Oh6Svq5pFw"

	// // Created a new CockroachDB account using vasek@usedevbook.com
	dbUser     = "dbk"
	dbPassword = "hlXRKDPiVa89WFNuz-0tXA"
	dbCluster  = "teak-wallaby-3666"
	dbRegion   = "aws-eu-west-1"

	defaultDatabaseID = "defaultdb"
)

var idAlphabet = []rune("abcdefghijklmnopqrstuvwxyz1234567890")

func genRandomID(length int) string {
	b := make([]rune, length)
	for i := range b {
		b[i] = idAlphabet[rand.Intn(len(idAlphabet))]
	}
	return fmt.Sprintf("userdb_%s", string(b))
}

func databaseURL(dbID string) string {
	return fmt.Sprintf(
		"postgresql://%s:%s@free-tier5.%s.cockroachlabs.cloud:26257/%s?sslmode=verify-full&options=--cluster=%s",
		dbUser,
		dbPassword,
		dbRegion,
		dbID,
		dbCluster,
	)
}

func createPool(ctx context.Context) (*pgxpool.Pool, error) {
	url := databaseURL(defaultDatabaseID)
	return pgxpool.Connect(ctx, url)
}

func CreateDatabase(ctx context.Context) (string, error) {
	log.Println("Create new database - creating pool")
	pool, err := createPool(ctx)
	if err != nil {
		return "", err
	}
	defer pool.Close()

	id := genRandomID(8)
	log.Printf("New database ID: %s\n", id)

	query := fmt.Sprintf("CREATE DATABASE %s;", id)
	log.Printf("New database SQL query: '%s'\n", query)

	_, err = pool.Exec(
		ctx,
		query,
	)

	if err != nil {
		return "", err
	}
	return databaseURL(id), nil
}

package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http/httputil"
	"net/url"

	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/cache"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/constants"
	"github.com/e2b-dev/infra/packages/shared/pkg/db"
)

type APIStore struct {
	db        *db.DB
	AuthCache *cache.AuthCache
	proxy     *httputil.ReverseProxy
}

func NewStore(ctx context.Context) *APIStore {
	authCache := cache.New()
	database, err := db.NewClient(ctx)
	if err != nil {
		log.Fatal(err)
	}

	targetUrl := &url.URL{
		Scheme: "https",
		Host:   fmt.Sprintf("%s-docker.pkg.dev", constants.GCPRegion),
	}

	proxy := httputil.NewSingleHostReverseProxy(targetUrl)

	return &APIStore{
		db:        database,
		AuthCache: authCache,
		proxy:     proxy,
	}
}

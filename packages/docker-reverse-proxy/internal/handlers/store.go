package handlers

import (
	"context"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/cache"
	"github.com/e2b-dev/infra/packages/shared/pkg/db"
	"log"
	"net/http/httputil"
	"net/url"
)

type APIStore struct {
	db        *db.DB
	AuthCache *cache.AuthCache
	Proxy     *httputil.ReverseProxy
}

func NewStore(ctx context.Context) *APIStore {
	authCache := cache.New()
	database, err := db.NewClient(ctx)
	if err != nil {
		log.Fatal(err)
	}

	// TODO: Move to env
	targetUrl := &url.URL{
		Scheme: "https",
		Host:   "us-central1-docker.pkg.dev",
	}

	proxy := httputil.NewSingleHostReverseProxy(targetUrl)

	return &APIStore{
		db:        database,
		AuthCache: authCache,
		Proxy:     proxy,
	}
}

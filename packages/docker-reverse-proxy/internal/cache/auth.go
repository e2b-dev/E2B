package cache

import (
	"fmt"
	"sync"
	"time"

	"github.com/jellydator/ttlcache/v3"
)

const (
	authInfoExpiration = time.Minute * 10 // 10 minutes
)

type AccessTokenData struct {
	AccessToken string
	EnvID       string
}

type AuthCache struct {
	cache *ttlcache.Cache[string, *AccessTokenData]

	mu sync.Mutex
}

func New() *AuthCache {
	cache := ttlcache.New(ttlcache.WithTTL[string, *AccessTokenData](authInfoExpiration))

	go cache.Start()

	return &AuthCache{
		cache: cache,
	}
}

// Get returns the auth token for the given teamID and e2bToken.
func (c *AuthCache) Get(e2bToken string) (*AccessTokenData, error) {
	item := c.cache.Get(e2bToken)

	if item == nil {
		return nil, fmt.Errorf("creds for %s not found in cache", e2bToken)
	}

	return item.Value(), nil
}

// Create creates a new auth token for the given teamID and accessToken and returns e2bToken
func (c *AuthCache) Create(userAccessToken, envID, encodedDockerRegistryAccessToken string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	data := &AccessTokenData{
		AccessToken: encodedDockerRegistryAccessToken,
		EnvID:       envID,
	}

	c.cache.Set(userAccessToken, data, authInfoExpiration)
}

package cache

import (
	"fmt"
	"time"

	"github.com/jellydator/ttlcache/v3"
)

const (
	authInfoExpiration = time.Hour * 2
)

type AccessTokenData struct {
	AccessToken string
	TemplateID  string
}

type AuthCache struct {
	cache *ttlcache.Cache[string, *AccessTokenData]
}

func New() *AuthCache {
	cache := ttlcache.New(ttlcache.WithTTL[string, *AccessTokenData](authInfoExpiration))

	go cache.Start()

	return &AuthCache{cache: cache}
}

// Get returns the auth token for the given teamID and e2bToken.
func (c *AuthCache) Get(e2bToken string) (*AccessTokenData, error) {
	item := c.cache.Get(e2bToken)

	if item == nil {
		return nil, fmt.Errorf("creds for %s not found in cache", e2bToken)
	}

	return item.Value(), nil
}

// Create creates a new auth token for the given templateID and accessToken and returns e2bToken
func (c *AuthCache) Create(userAccessToken, templateID, encodedDockerRegistryAccessToken string) {
	data := &AccessTokenData{
		AccessToken: encodedDockerRegistryAccessToken,
		TemplateID:  templateID,
	}

	c.cache.Set(userAccessToken, data, authInfoExpiration)
}

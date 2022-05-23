package nomad

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/devbookhq/orchestration-services/api/internal/api"
	"github.com/jellydator/ttlcache/v3"
)

const (
	SessionExpiration = time.Second * 30000
)

type SessionCache struct {
	cache *ttlcache.Cache[string, *api.Session]
}

// Add the session to the cache and start expiration timer
func (c *SessionCache) Add(session *api.Session) error {
	if c.Exists(session.SessionID) {
		return fmt.Errorf("Session \"%s\" already exists", session.SessionID)
	}

	c.cache.Set(session.SessionID, session, ttlcache.DefaultTTL)
	return nil
}

// Refresh the session's expiration timer
func (c *SessionCache) Refresh(sessionID string) error {
	item := c.cache.Get(sessionID)

	if item == nil {
		return fmt.Errorf("Session \"%s\" doesn't exist", sessionID)
	}

	return nil
}

// Check if the session exists in the cache
func (c *SessionCache) Exists(sessionID string) bool {
	item := c.cache.Get(sessionID, ttlcache.WithDisableTouchOnHit[string, *api.Session]())

	return item != nil
}

// We will need to either use Redis for storing active sessions OR retrieve them from Nomad when we start API to keep everything in sync
// We are retrieving the tasks from Nomad now
func NewSessionCache(handleDeleteSession func(sessionID string) *api.APIError, initialSessions []*api.Session) *SessionCache {
	cache := ttlcache.New(
		ttlcache.WithTTL[string, *api.Session](SessionExpiration),
	)

	cache.OnEviction(func(ctx context.Context, er ttlcache.EvictionReason, i *ttlcache.Item[string, *api.Session]) {
		if er == ttlcache.EvictionReasonExpired {
			err := handleDeleteSession(i.Key())
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error deleting session after expiration (%s)\n: %s", SessionExpiration.String(), err.Error())
			}
		}
	})

	sessionCache := &SessionCache{
		cache: cache,
	}

	for _, session := range initialSessions {
		sessionCache.Add(session)
	}

	go cache.Start()

	return sessionCache
}

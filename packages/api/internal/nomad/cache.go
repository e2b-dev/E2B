package nomad

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/devbookhq/devbook-api/packages/api/internal/api"
	"github.com/jellydator/ttlcache/v3"
)

const (
	sessionExpiration = time.Second * 20
	cacheSyncTime     = time.Second * 30
)

type SessionCache struct {
	cache *ttlcache.Cache[string, *api.Session]
}

// Add the session to the cache and start expiration timer
func (c *SessionCache) Add(session *api.Session) error {
	if c.Exists(session.SessionID) {
		return fmt.Errorf("session \"%s\" already exists", session.SessionID)
	}

	c.cache.Set(session.SessionID, session, ttlcache.DefaultTTL)
	return nil
}

// Refresh the session's expiration timer
func (c *SessionCache) Refresh(sessionID string) error {
	item := c.cache.Get(sessionID)

	if item == nil {
		return fmt.Errorf("session \"%s\" doesn't exist", sessionID)
	}

	return nil
}

// Check if the session exists in the cache
func (c *SessionCache) Exists(sessionID string) bool {
	item := c.cache.Get(sessionID, ttlcache.WithDisableTouchOnHit[string, *api.Session]())

	return item != nil
}

func (c *SessionCache) FindEditSession(codeSnippetID string) (*api.Session, error) {
	for _, item := range c.cache.Items() {
		if item.Value() == nil {
			continue
		}

		if item.Value().EditEnabled && item.Value().CodeSnippetID == codeSnippetID {
			c.Refresh(item.Key())
			return item.Value(), nil
		}
	}

	return nil, fmt.Errorf("error edit session for code snippet '%s' not found", codeSnippetID)
}

func (c *SessionCache) Sync(sessions []*api.Session) {
	sessionsMap := make(map[string]*api.Session)
	for _, session := range sessions {
		sessionsMap[session.SessionID] = session
	}

	for _, cacheSession := range c.cache.Items() {
		if cacheSession == nil {
			continue
		}

		if cacheSession.Value() == nil {
			c.cache.Delete(cacheSession.Key())
			continue
		}

		if sessionsMap[cacheSession.Key()] == nil {
			c.cache.Delete(cacheSession.Key())
			continue
		}
	}
}

// We will need to either use Redis for storing active sessions OR retrieve them from Nomad when we start API to keep everything in sync
// We are retrieving the tasks from Nomad now
func NewSessionCache(handleDeleteSession func(sessionID string, purge bool) *api.APIError, initialSessions []*api.Session) *SessionCache {
	cache := ttlcache.New(
		ttlcache.WithTTL[string, *api.Session](sessionExpiration),
	)

	cache.OnEviction(func(ctx context.Context, er ttlcache.EvictionReason, i *ttlcache.Item[string, *api.Session]) {
		if er == ttlcache.EvictionReasonExpired || er == ttlcache.EvictionReasonDeleted {
			err := handleDeleteSession(i.Key(), true)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error deleting session (%v)\n: %s", er, err.Error())
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

// Sync the cache with the actual sessions in Nomad to handle sessions that died.
func (c *SessionCache) KeepInSync(client *NomadClient) {
	go func() {
		ticker := time.NewTicker(cacheSyncTime)
		defer ticker.Stop()

		for range ticker.C {
			activeSessions, err := client.GetSessions()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error loading current sessions from Nomad\n: %s", err)
			} else {
				c.Sync(activeSessions)
			}
		}
	}()
}

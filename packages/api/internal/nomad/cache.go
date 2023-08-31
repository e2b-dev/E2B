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
	sessionExpiration = time.Second * 12
	cacheSyncTime     = time.Second * 180
)

type SessionData struct {
	Session   *api.Session
	TeamID    *string
	StartTime *time.Time
}

type SessionCache struct {
	cache *ttlcache.Cache[string, SessionData]
}

// Add the session to the cache and start expiration timer
func (c *SessionCache) Add(session *api.Session, teamID *string, startTime *time.Time) error {
	if c.Exists(session.SessionID) {
		return fmt.Errorf("session \"%s\" already exists", session.SessionID)
	}
	sessionData := SessionData{
		Session:   session,
		TeamID:    teamID,
		StartTime: startTime,
	}
	c.cache.Set(session.SessionID, sessionData, ttlcache.DefaultTTL)
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

// Get the session from the cache
func (c *SessionCache) Get(sessionID string) SessionData {
	item := c.cache.Get(sessionID, ttlcache.WithDisableTouchOnHit[string, SessionData]())
	if item != nil {
		return item.Value()
	} else {
		panic(fmt.Errorf("session \"%s\" doesn't exist", sessionID))
	}
}

// Check if the session exists in the cache
func (c *SessionCache) Exists(sessionID string) bool {
	item := c.cache.Get(sessionID, ttlcache.WithDisableTouchOnHit[string, SessionData]())
	return item != nil
}

func (c *SessionCache) FindEditSession(codeSnippetID string) (*api.Session, error) {
	for _, item := range c.cache.Items() {
		if item.Value().Session == nil {
			continue
		}

		if item.Value().Session.EditEnabled && item.Value().Session.CodeSnippetID == codeSnippetID {
			c.Refresh(item.Key())
			return item.Value().Session, nil
		}
	}
	return nil, fmt.Errorf("error edit session for code snippet '%s' not found", codeSnippetID)
}

func (c *SessionCache) Sync(sessions []*api.Session) {
	for _, session := range sessions {
		if !c.Exists(session.SessionID) {
			c.Add(session, nil, nil)
		}
	}
}

// We will need to either use Redis for storing active sessions OR retrieve them from Nomad when we start API to keep everything in sync
// We are retrieving the tasks from Nomad now
func NewSessionCache(handleDeleteSession func(sessionData SessionData, purge bool) *api.APIError, initialSessions []*api.Session) *SessionCache {
	cache := ttlcache.New(
		ttlcache.WithTTL[string, SessionData](sessionExpiration),
	)

	cache.OnEviction(func(ctx context.Context, er ttlcache.EvictionReason, i *ttlcache.Item[string, SessionData]) {
		if er == ttlcache.EvictionReasonExpired || er == ttlcache.EvictionReasonDeleted {
			err := handleDeleteSession(i.Value(), true)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error deleting session (%v)\n: %s", er, err.Error())
			}
		}
	})

	sessionCache := &SessionCache{
		cache: cache,
	}

	for _, session := range initialSessions {
		sessionCache.Add(session, nil, nil)
	}

	go cache.Start()

	return sessionCache
}

// Sync the cache with the actual sessions in Nomad to handle sessions that died.
func (c *SessionCache) KeepInSync(client *NomadClient) {
	for {
		time.Sleep(cacheSyncTime)
		activeSessions, err := client.GetSessions()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading current sessions from Nomad\n: %s", err)
		} else {
			c.Sync(activeSessions)
		}
	}
}

func (c *SessionCache) Count() int {
	return c.cache.Len()
}

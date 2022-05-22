package refresh

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/devbookhq/orchestration-services/modules/api/api-image/internal/api"
	"github.com/jellydator/ttlcache/v3"
)

const (
	SessionExpiration = time.Second * 180
)

type SessionCache struct {
	cache *ttlcache.Cache[string, bool]
}

func (r *SessionCache) Register(session *api.Session) {
	r.cache.Set(session.SessionID, true, ttlcache.DefaultTTL)
}

func (r *SessionCache) Refresh(sessionID string) error {
	item := r.cache.Get(sessionID)

	if item == nil {
		return fmt.Errorf("Session \"%s\" doesn't exist", sessionID)
	}

	return nil
}

// We will need to either use Redis for storing active sessions OR retrieve them from Nomad when we start API to keep everything in sync
// We are retrieving the tasks from Nomad now
func NewSessionCache(handleDeleteSession func(sessionID string) error, initialSessions []*api.Session) *SessionCache {
	cache := ttlcache.New(
		ttlcache.WithTTL[string, bool](SessionExpiration),
	)

	cache.OnEviction(func(ctx context.Context, er ttlcache.EvictionReason, i *ttlcache.Item[string, bool]) {
		if er == ttlcache.EvictionReasonExpired {
			err := handleDeleteSession(i.Key())
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error deleting session after expiration\n: %s", err)
			}
		}
	})

	sessionCache := &SessionCache{
		cache: cache,
	}

	for _, session := range initialSessions {
		sessionCache.Register(session)
	}

	go cache.Start()

	return sessionCache
}

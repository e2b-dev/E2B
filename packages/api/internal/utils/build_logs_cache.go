package utils

import (
	"fmt"
	"sync"
	"time"

	"github.com/jellydator/ttlcache/v3"
)

const (
	logsExpiration = time.Second * 60 * 5 // 5 minutes
)

type buildEnvID struct {
	envID   string
	buildID string
}

type BuildLogsCache struct {
	cache *ttlcache.Cache[buildEnvID, []string]
	mutex sync.RWMutex
}

func NewBuildLogsCache() *BuildLogsCache {
	return &BuildLogsCache{
		cache: ttlcache.New(ttlcache.WithTTL[buildEnvID, []string](logsExpiration)),
		mutex: sync.RWMutex{},
	}
}

func (c *BuildLogsCache) Get(envID, buildID string) ([]string, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	key := &buildEnvID{envID: envID, buildID: buildID}
	item := c.cache.Get(*key)

	if item != nil {
		return item.Value(), nil
	}

	return nil, fmt.Errorf("build %s for %s not found in cache", buildID, envID)
}

func (c *BuildLogsCache) Append(envID, buildID string, logs []string) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	key := &buildEnvID{envID: envID, buildID: buildID}
	item := c.cache.Get(*key)

	if item == nil {
		c.cache.Set(*key, logs, logsExpiration)
	} else {
		c.cache.Set(*key, append(item.Value(), logs...), logsExpiration)
	}

	return nil
}

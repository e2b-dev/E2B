package utils

import (
	"fmt"
	"github.com/e2b-dev/infra/packages/api/internal/api"
	"sync"
	"time"

	"github.com/jellydator/ttlcache/v3"
)

const (
	logsExpiration = time.Second * 60 * 5 // 5 minutes
)

type Build struct {
	BuildID string
	TeamID  string
	Status  api.EnvironmentBuildStatus
	Logs    []string
}

type BuildCache struct {
	cache *ttlcache.Cache[string, Build]
	mutex sync.RWMutex
}

func NewBuildCache() *BuildCache {
	return &BuildCache{
		cache: ttlcache.New(ttlcache.WithTTL[string, Build](logsExpiration)),
		mutex: sync.RWMutex{},
	}
}

// get returns the build info without locking the mutex
func (c *BuildCache) get(envID string, buildID string) (Build, error) {
	item := c.cache.Get(envID)

	if item != nil {
		if item.Value().BuildID != buildID {
			return Build{}, fmt.Errorf("received logs for another build %s env %s", buildID, envID)
		}
		return item.Value(), nil
	}

	return Build{}, fmt.Errorf("build for %s not found in cache", envID)
}

// Get returns the build info
func (c *BuildCache) Get(envID string, buildID string) (Build, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	return c.get(envID, buildID)
}

// Append appends logs to the build
func (c *BuildCache) Append(envID, buildID string, logs []string) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	item, err := c.get(envID, buildID)
	if err != nil {
		err = fmt.Errorf("build for %s not found in cache: %w", envID, err)

		return err
	}

	c.cache.Set(envID, Build{
		BuildID: item.BuildID,
		TeamID:  item.TeamID,
		Status:  item.Status,
		Logs:    append(item.Logs, logs...),
	}, logsExpiration)

	return nil
}

// CreateIfNotExists creates a new build if it doesn't exist in the cache or the build was already finished
func (c *BuildCache) CreateIfNotExists(teamID, envID, buildID string) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	item := c.cache.Get(envID)
	if item != nil && item.Value().Status == api.EnvironmentBuildStatusBuilding {
		return fmt.Errorf("build for %s already exists in cache", envID)
	}

	buildLog := Build{
		BuildID: buildID,
		TeamID:  teamID,
		Status:  api.EnvironmentBuildStatusBuilding,
		Logs:    []string{},
	}
	c.cache.Set(envID, buildLog, logsExpiration)

	return nil
}

// Create creates a new build in the cache
func (c *BuildCache) Create(teamID string, envID string, buildID string) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	buildLog := Build{
		BuildID: buildID,
		TeamID:  teamID,
		Status:  api.EnvironmentBuildStatusBuilding,
		Logs:    []string{},
	}
	c.cache.Set(envID, buildLog, logsExpiration)
}

// SetDone marks the build as finished
func (c *BuildCache) SetDone(envID string, buildID string, status api.EnvironmentBuildStatus) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	item, err := c.get(envID, buildID)

	if err != nil {
		return fmt.Errorf("build %s not found in cache: %w", buildID, err)
	}

	c.cache.Set(envID, Build{
		BuildID: item.BuildID,
		Status:  status,
		Logs:    item.Logs,
		TeamID:  item.TeamID,
	}, logsExpiration)

	return nil
}

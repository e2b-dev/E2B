package utils

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/jellydator/ttlcache/v3"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"

	"github.com/e2b-dev/infra/packages/api/internal/api"
)

const (
	logsExpiration = time.Minute * 5 // 5 minutes
)

type Build struct {
	BuildID string
	TeamID  string
	Status  api.EnvironmentBuildStatus
	Logs    []string
}

type BuildCache struct {
	cache   *ttlcache.Cache[string, Build]
	counter metric.Int64UpDownCounter
	mu      sync.RWMutex
}

func NewBuildCache(counter metric.Int64UpDownCounter) *BuildCache {
	cache := ttlcache.New(ttlcache.WithTTL[string, Build](logsExpiration))

	return &BuildCache{
		cache:   cache,
		counter: counter,
	}
}

// Get returns the build info
func (c *BuildCache) Get(envID string, buildID string) (*Build, error) {
	item := c.cache.Get(envID)

	if item == nil {
		return nil, fmt.Errorf("build for %s not found in cache", envID)
	}

	value := item.Value()

	if value.BuildID != buildID {
		return nil, fmt.Errorf("received logs for another build %s env %s", buildID, envID)
	}

	return &value, nil
}

// Append appends logs to the build
func (c *BuildCache) Append(envID, buildID string, logs []string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	item, err := c.Get(envID, buildID)
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
func (c *BuildCache) Create(teamID, envID, buildID string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	item := c.cache.Get(envID)
	if item != nil && item.Value().Status == api.EnvironmentBuildStatusBuilding {
		return fmt.Errorf("build for %s already exists in cache", envID)
	}

	c.cache.Set(envID, Build{
		BuildID: buildID,
		TeamID:  teamID,
		Status:  api.EnvironmentBuildStatusBuilding,
		Logs:    []string{},
	}, logsExpiration)

	c.updateCounter(envID, buildID, 1)

	return nil
}

// SetDone marks the build as finished
func (c *BuildCache) SetDone(envID string, buildID string, status api.EnvironmentBuildStatus) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	item, err := c.Get(envID, buildID)
	if err != nil {
		return fmt.Errorf("build %s not found in cache: %w", buildID, err)
	}

	c.cache.Set(envID, Build{
		BuildID: item.BuildID,
		Status:  status,
		Logs:    item.Logs,
		TeamID:  item.TeamID,
	}, logsExpiration)

	c.updateCounter(envID, buildID, -1)

	return nil
}

func (c *BuildCache) updateCounter(envID, buildID string, value int64) {
	c.counter.Add(context.Background(), value,
		metric.WithAttributes(attribute.String("env_id", envID)),
		metric.WithAttributes(attribute.String("build_id", buildID)),
	)
}

func (c *BuildCache) Delete(envID, buildID string) {
	c.cache.Delete(envID)
	c.updateCounter(envID, buildID, -1)
}

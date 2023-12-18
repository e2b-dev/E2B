package nomad

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jellydator/ttlcache/v3"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"

	"github.com/e2b-dev/infra/packages/api/internal/api"
)

const (
	buildInfoExpiration = time.Minute * 5 // 5 minutes
)

type BuildInfo struct {
	buildID uuid.UUID
	teamID  uuid.UUID
	status  api.EnvironmentBuildStatus
	logs    []string

	mu sync.RWMutex
}

func (b *BuildInfo) GetLogs() []string {
	b.mu.RLock()
	defer b.mu.RUnlock()

	return b.logs
}

func (b *BuildInfo) GetStatus() api.EnvironmentBuildStatus {
	b.mu.RLock()
	defer b.mu.RUnlock()

	return b.status
}

func (b *BuildInfo) GetBuildID() uuid.UUID {
	b.mu.RLock()
	defer b.mu.RUnlock()

	return b.buildID
}

func (b *BuildInfo) GetTeamID() uuid.UUID {
	b.mu.RLock()
	defer b.mu.RUnlock()

	return b.teamID
}

func (b *BuildInfo) addLogs(logs []string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.logs = append(b.logs, logs...)
}

func (b *BuildInfo) setStatus(status api.EnvironmentBuildStatus) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.status = status
}

type BuildCache struct {
	cache   *ttlcache.Cache[string, *BuildInfo]
	counter metric.Int64UpDownCounter
}

func NewBuildCache(counter metric.Int64UpDownCounter) *BuildCache {
	cache := ttlcache.New(ttlcache.WithTTL[string, *BuildInfo](buildInfoExpiration))

	go cache.Start()

	return &BuildCache{
		cache:   cache,
		counter: counter,
	}
}

// Get returns the build info
func (c *BuildCache) Get(envID string, buildID uuid.UUID) (*BuildInfo, error) {
	item := c.cache.Get(envID)

	if item == nil {
		return nil, fmt.Errorf("build for %s not found in cache", envID)
	}

	value := item.Value()

	if value == nil {
		return nil, fmt.Errorf("build for %s not found in cache", envID)
	}

	if value.GetBuildID() != buildID {
		return nil, fmt.Errorf("received logs for another build %s env %s", buildID, envID)
	}

	return value, nil
}

// Append appends logs to the build
func (c *BuildCache) Append(envID string, buildID uuid.UUID, logs []string) error {
	item, err := c.Get(envID, buildID)
	if err != nil {
		errMsg := fmt.Errorf("build for %s not found in cache: %w", envID, err)

		return errMsg
	}

	item.addLogs(logs)

	return nil
}

// Create creates a new build if it doesn't exist in the cache or the build was already finished
func (c *BuildCache) Create(envID string, buildID uuid.UUID, teamID uuid.UUID) error {
	info := BuildInfo{
		buildID: buildID,
		teamID:  teamID,
		status:  api.EnvironmentBuildStatusBuilding,
		// We need to explicitly set the logs to an empty slice for the json serialization to work in CLI
		logs: []string{},
	}

	cacheInfo, ok := c.cache.GetOrSet(
		envID,
		&info,
		ttlcache.WithTTL[string, *BuildInfo](buildInfoExpiration),
	)

	if ok && cacheInfo.Value().GetStatus() == api.EnvironmentBuildStatusBuilding {
		return fmt.Errorf("build for %s already exists in cache", envID)
	}

	c.updateCounter(envID, buildID, teamID, 1)

	return nil
}

// SetDone marks the build as finished
func (c *BuildCache) SetDone(envID string, buildID uuid.UUID, status api.EnvironmentBuildStatus) error {
	item, err := c.Get(envID, buildID)
	if err != nil {
		return fmt.Errorf("build %s not found in cache: %w", buildID, err)
	}

	item.setStatus(status)
	c.updateCounter(envID, buildID, item.teamID, -1)

	return nil
}

func (c *BuildCache) updateCounter(envID string, buildID, teamID uuid.UUID, value int64) {
	c.counter.Add(context.Background(), value,
		metric.WithAttributes(attribute.String("env_id", envID)),
		metric.WithAttributes(attribute.String("build_id", buildID.String())),
		metric.WithAttributes(attribute.String("team_id", teamID.String())),
	)
}

func (c *BuildCache) Delete(envID string, buildID, teamID uuid.UUID) {
	c.cache.Delete(envID)
	c.updateCounter(envID, buildID, teamID, -1)
}

package nomad

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jellydator/ttlcache/v3"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.uber.org/zap"
	"google.golang.org/protobuf/types/known/timestamppb"

	analyticscollector "github.com/e2b-dev/infra/packages/api/internal/analytics_collector"
	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const (
	InstanceExpiration = time.Second * 15
	cacheSyncTime      = time.Minute * 3
)

type InstanceInfo struct {
	Instance          *api.Sandbox
	TeamID            *uuid.UUID
	Metadata          map[string]string
	StartTime         *time.Time
	MaxInstanceLength time.Duration
}

type InstanceCache struct {
	cache     *ttlcache.Cache[string, InstanceInfo]
	counter   metric.Int64UpDownCounter
	logger    *zap.SugaredLogger
	analytics analyticscollector.AnalyticsCollectorClient
}

// Add the instance to the cache and start expiration timer.
// If the instance already exists we do nothing - it was loaded from Nomad.
func (c *InstanceCache) Add(instance InstanceInfo) error {
	if instance.StartTime == nil {
		now := time.Now()
		instance.StartTime = &now
	}

	if instance.TeamID == nil || instance.Instance.SandboxID == "" || instance.Instance.ClientID == "" || instance.Instance.TemplateID == "" {
		return fmt.Errorf("instance %+v (%+v) is missing team ID, instance ID, client ID, or env ID ", instance, instance.Instance)
	}

	c.cache.Set(instance.Instance.SandboxID, instance, ttlcache.DefaultTTL)
	c.UpdateCounter(instance, 1)

	return nil
}

func getMaxAllowedTTL(startTime time.Time, duration, maxInstanceLength time.Duration) time.Duration {
	runningTime := time.Since(startTime)
	timeLeft := maxInstanceLength - runningTime

	if timeLeft <= 0 {
		return 0
	} else if duration < timeLeft {
		return duration
	} else {
		return timeLeft
	}
}

// KeepAliveFor the instance's expiration timer.
func (c *InstanceCache) KeepAliveFor(instanceID string, duration time.Duration) error {
	item, err := c.Get(instanceID)
	if err != nil {
		return err
	}

	if item.ExpiresAt().After(time.Now().Add(duration)) {
		return nil
	}

	instance := item.Value()
	if (time.Since(*instance.StartTime)) > instance.MaxInstanceLength {
		c.cache.Delete(instanceID)

		return fmt.Errorf("instance \"%s\" reached maximal allowed uptime", instanceID)
	} else {
		maxAllowedTTL := getMaxAllowedTTL(*instance.StartTime, duration, instance.MaxInstanceLength)

		item = c.cache.Set(instanceID, instance, maxAllowedTTL)
		if item == nil {
			return fmt.Errorf("instance \"%s\" doesn't exist", instanceID)
		}
	}

	return nil
}

// Kill the instance and remove it from the cache.
func (c *InstanceCache) Kill(instanceID string) {
	c.cache.Delete(instanceID)
}

// Get the item from the cache.
func (c *InstanceCache) Get(instanceID string) (*ttlcache.Item[string, InstanceInfo], error) {
	item := c.cache.Get(instanceID, ttlcache.WithDisableTouchOnHit[string, InstanceInfo]())
	if item != nil {
		return item, nil
	} else {
		return nil, fmt.Errorf("instance \"%s\" doesn't exist", instanceID)
	}
}

// GetInstance from the cache.
func (c *InstanceCache) GetInstance(instanceID string) (InstanceInfo, error) {
	item, err := c.Get(instanceID)
	if err != nil {
		return InstanceInfo{}, fmt.Errorf("instance \"%s\" doesn't exist", instanceID)
	} else {
		return item.Value(), nil
	}
}

// Check if the instance exists in the cache.
func (c *InstanceCache) Exists(instanceID string) bool {
	item := c.cache.Get(instanceID, ttlcache.WithDisableTouchOnHit[string, InstanceInfo]())

	return item != nil
}

func (c *InstanceCache) Sync(instances []*InstanceInfo) {
	instanceMap := make(map[string]*InstanceInfo)

	// Use map for faster lookup
	for _, instance := range instances {
		instanceMap[instance.Instance.SandboxID] = instance
	}

	// Delete instances that are not in Nomad anymore
	for _, item := range c.cache.Items() {
		_, found := instanceMap[item.Key()]
		if !found {
			c.cache.Delete(item.Key())
		}
	}

	// Add instances that are not in the cache with the default TTL
	for _, instance := range instances {
		if !c.Exists(instance.Instance.SandboxID) {
			err := c.Add(*instance)
			if err != nil {
				fmt.Println(fmt.Errorf("error adding instance to cache: %w", err))
			}
		}
	}

	// Send running instances event to analytics
	instanceIds := make([]string, len(instances))
	for i, instance := range instances {
		instanceIds[i] = instance.Instance.SandboxID
	}

	_, err := c.analytics.RunningInstances(context.Background(), &analyticscollector.RunningInstancesEvent{InstanceIds: instanceIds, Timestamp: timestamppb.Now()})
	if err != nil {
		c.logger.Errorf("Error sending running instances event to analytics\n: %v", err)
	}
}

// We will need to either use Redis for storing active instances OR retrieve them from Nomad when we start API to keep everything in sync
// We are retrieving the tasks from Nomad now.
func NewInstanceCache(analytics analyticscollector.AnalyticsCollectorClient, logger *zap.SugaredLogger, deleteInstance func(data InstanceInfo, purge bool) *api.APIError, initialInstances []*InstanceInfo, counter metric.Int64UpDownCounter) *InstanceCache {
	cache := ttlcache.New(
		ttlcache.WithTTL[string, InstanceInfo](InstanceExpiration),
	)

	instanceCache := &InstanceCache{
		cache:     cache,
		counter:   counter,
		logger:    logger,
		analytics: analytics,
	}

	cache.OnInsertion(func(ctx context.Context, i *ttlcache.Item[string, InstanceInfo]) {
		instanceInfo := i.Value()
		_, err := analytics.InstanceStarted(ctx, &analyticscollector.InstanceStartedEvent{
			InstanceId:    instanceInfo.Instance.SandboxID,
			EnvironmentId: instanceInfo.Instance.TemplateID,
			TeamId:        instanceInfo.TeamID.String(),
			Timestamp:     timestamppb.Now(),
		})
		if err != nil {
			errMsg := fmt.Errorf("error when sending analytics event: %w", err)
			telemetry.ReportCriticalError(ctx, errMsg)
		}
	})
	cache.OnEviction(func(ctx context.Context, er ttlcache.EvictionReason, i *ttlcache.Item[string, InstanceInfo]) {
		if er == ttlcache.EvictionReasonExpired || er == ttlcache.EvictionReasonDeleted {
			err := deleteInstance(i.Value(), true)
			if err != nil {
				logger.Errorf("Error deleting instance (%v)\n: %v", er, err.Err)
			}

			instanceCache.UpdateCounter(i.Value(), -1)
		}
	})

	for _, instance := range initialInstances {
		err := instanceCache.Add(*instance)
		if err != nil {
			fmt.Println(fmt.Errorf("error adding instance to cache: %w", err))
		}
	}

	go cache.Start()

	return instanceCache
}

// Sync the cache with the actual instances in Nomad to handle instances that died.
func (c *InstanceCache) KeepInSync(client *NomadClient) {
	for {
		time.Sleep(cacheSyncTime)

		activeInstances, err := client.GetInstances()
		if err != nil {
			c.logger.Errorf("Error loading current instances from Nomad\n: %v", err.Err)
		} else {
			c.Sync(activeInstances)
		}
	}
}

func (c *InstanceCache) Count() int {
	return c.cache.Len()
}

func (c *InstanceCache) CountForTeam(teamID uuid.UUID) (count uint) {
	for _, item := range c.cache.Items() {
		currentTeamID := item.Value().TeamID

		if currentTeamID == nil {
			continue
		}

		if *currentTeamID == teamID {
			count++
		}
	}

	return count
}

func (c *InstanceCache) UpdateCounter(instance InstanceInfo, value int64) {
	c.counter.Add(context.Background(), value, metric.WithAttributes(
		attribute.String("instance_id", instance.Instance.SandboxID),
		attribute.String("env_id", instance.Instance.TemplateID),
		attribute.String("team_id", instance.TeamID.String()),
	))
}

func (c *InstanceCache) GetInstances(teamID *uuid.UUID) (instances []InstanceInfo) {
	for _, item := range c.cache.Items() {
		currentTeamID := item.Value().TeamID

		if teamID == nil || *currentTeamID == *teamID {
			instances = append(instances, item.Value())
		}
	}

	return instances
}

package nomad

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jellydator/ttlcache/v3"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"

	"github.com/e2b-dev/infra/packages/api/internal/api"
)

const (
	InstanceExpiration = time.Second * 15
	cacheSyncTime      = time.Minute * 3
	maxInstanceLength  = time.Hour * 24
)

type InstanceInfo struct {
	Instance  *api.Instance
	TeamID    *uuid.UUID
	StartTime *time.Time
}

type InstanceCache struct {
	cache   *ttlcache.Cache[string, InstanceInfo]
	counter metric.Int64UpDownCounter
}

// Add the instance to the cache and start expiration timer.
func (c *InstanceCache) Add(instance *api.Instance, teamID *uuid.UUID, startTime *time.Time) error {
	if c.Exists(instance.InstanceID) {
		return fmt.Errorf("instance \"%s\" already exists", instance.InstanceID)
	}

	if startTime == nil {
		startTime = &time.Time{}
		*startTime = time.Now()
	}

	instanceData := InstanceInfo{
		Instance:  instance,
		TeamID:    teamID,
		StartTime: startTime,
	}

	c.cache.Set(instance.InstanceID, instanceData, ttlcache.DefaultTTL)
	c.counter.Add(context.Background(), 1, metric.WithAttributes(attribute.String("instance_id", instance.InstanceID)))

	return nil
}

func getMaxAllowedTTL(startTime time.Time, duration time.Duration) time.Duration {
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
	if (time.Since(*instance.StartTime)) > maxInstanceLength {
		c.cache.Delete(instanceID)

		return fmt.Errorf("instance \"%s\" reached maximal allowed uptime", instanceID)
	} else {
		maxAllowedTTL := getMaxAllowedTTL(*instance.StartTime, duration)

		item = c.cache.Set(instanceID, instance, maxAllowedTTL)
		if item == nil {
			return fmt.Errorf("instance \"%s\" doesn't exist", instanceID)
		}
	}

	return nil
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

func (c *InstanceCache) Sync(instances []*api.Instance) {
	instanceMap := make(map[string]*api.Instance)

	// Use map for faster lookup
	for _, instance := range instances {
		instanceMap[instance.InstanceID] = instance
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
		if !c.Exists(instance.InstanceID) {
			err := c.Add(instance, nil, nil)
			if err != nil {
				fmt.Println(fmt.Errorf("error adding instance to cache: %w", err))
			}
		}
	}
}

// We will need to either use Redis for storing active instances OR retrieve them from Nomad when we start API to keep everything in sync
// We are retrieving the tasks from Nomad now.
func NewInstanceCache(deleteInstance func(data InstanceInfo, purge bool) *api.APIError, initialInstances []*api.Instance, counter metric.Int64UpDownCounter) *InstanceCache {
	cache := ttlcache.New(
		ttlcache.WithTTL[string, InstanceInfo](InstanceExpiration),
	)

	cache.OnEviction(func(ctx context.Context, er ttlcache.EvictionReason, i *ttlcache.Item[string, InstanceInfo]) {
		if er == ttlcache.EvictionReasonExpired || er == ttlcache.EvictionReasonDeleted {
			err := deleteInstance(i.Value(), true)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error deleting instance (%v)\n: %v\n", er, err.Err)
			}
			counter.Add(ctx, -1, metric.WithAttributes(attribute.String("instance_id", i.Value().Instance.InstanceID)))
		}
	})

	instanceCache := &InstanceCache{
		cache:   cache,
		counter: counter,
	}

	for _, instance := range initialInstances {
		err := instanceCache.Add(instance, nil, nil)
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
			fmt.Fprintf(os.Stderr, "Error loading current instances from Nomad\n: %v\n", err.Err)
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

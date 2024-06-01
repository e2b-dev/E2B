package instance

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jellydator/ttlcache/v3"
)

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

// Check if the instance exists in the cache.
func (c *InstanceCache) Exists(instanceID string) bool {
	item := c.cache.Get(instanceID, ttlcache.WithDisableTouchOnHit[string, InstanceInfo]())

	return item != nil
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

func (c *InstanceCache) GetInstances(teamID *uuid.UUID) (instances []InstanceInfo) {
	for _, item := range c.cache.Items() {
		currentTeamID := item.Value().TeamID

		if teamID == nil || *currentTeamID == *teamID {
			instances = append(instances, item.Value())
		}
	}

	return instances
}

// Add the instance to the cache and start expiration timer.
// If the instance already exists we do nothing - it was loaded from Orchestrator.
func (c *InstanceCache) Add(instance InstanceInfo, timeout *int32) error {
	if instance.StartTime == nil {
		now := time.Now()
		instance.StartTime = &now
	}

	if instance.TeamID == nil || instance.Instance.SandboxID == "" || instance.Instance.ClientID == "" || instance.Instance.TemplateID == "" {
		return fmt.Errorf("instance %+v (%+v) is missing team ID, instance ID, client ID, or env ID ", instance, instance.Instance)
	}

	// TODO: Handle the need to pass timeout when recovering sandboxes after orchestrator restart — we need to save the info about the timeout in the cache too.
	t := InstanceExpiration
	if timeout != nil {
		t = time.Duration(*timeout) * time.Second
	}

	c.cache.Set(instance.Instance.SandboxID, instance, t)
	c.UpdateCounter(instance, 1)

	// Release the reservation if it exists
	c.reservations.release(instance.Instance.SandboxID)

	return nil
}

// Kill the instance and remove it from the cache.
func (c *InstanceCache) Kill(instanceID string) {
	c.cache.Delete(instanceID)
}

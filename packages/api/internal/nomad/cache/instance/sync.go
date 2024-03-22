package instance

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	analyticscollector "github.com/e2b-dev/infra/packages/api/internal/analytics_collector"
)

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

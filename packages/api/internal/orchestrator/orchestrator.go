package orchestrator

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/nomad/cache/instance"
)

var orchestratorAddress = os.Getenv("ORCHESTRATOR_ADDRESS")

type Orchestrator struct {
	client *Client
}

func New() (*Orchestrator, error) {
	client, err := NewClient(orchestratorAddress)
	if err != nil {
		return nil, err
	}

	return &Orchestrator{
		client: client,
	}, nil
}

// Sync the cache with the actual instances in Nomad to handle instances that died.
func (o *Orchestrator) KeepInSync(ctx context.Context, instanceCache *instance.InstanceCache) {
	for {
		time.Sleep(instance.CacheSyncTime)

		activeInstances, err := o.GetInstances(ctx)
		if err != nil {
			fmt.Printf("Error loading current instances from Nomad\n: %v", err)
		} else {
			instanceCache.Sync(activeInstances)
		}
	}
}

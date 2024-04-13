package orchestrator

import (
	"context"
	"fmt"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/nomad/cache/instance"
)

type Orchestrator struct {
	grpc *GRPCClient
}

func New() (*Orchestrator, error) {
	client, err := NewClient()
	if err != nil {
		return nil, err
	}

	return &Orchestrator{
		grpc: client,
	}, nil
}

func (o *Orchestrator) Close() error {
	return o.grpc.Close()
}

// KeepInSync the cache with the actual instances in Nomad to handle instances that died.
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

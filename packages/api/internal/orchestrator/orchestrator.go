package orchestrator

import (
	"context"
	"fmt"
	"os"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/api/internal/cache/instance"
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

// KeepInSync the cache with the actual instances in Orchestrator to handle instances that died.
func (o *Orchestrator) KeepInSync(ctx context.Context, tracer trace.Tracer, instanceCache *instance.InstanceCache) {
	for {
		time.Sleep(instance.CacheSyncTime)

		childCtx, childSpan := tracer.Start(ctx, "keep-in-sync")
		activeInstances, err := o.GetInstances(childCtx, tracer)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading current sandboxes\n: %v", err)
		} else {
			instanceCache.Sync(activeInstances)
		}

		childSpan.End()
	}
}

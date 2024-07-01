package sandbox

import (
	"context"
	"fmt"
	"time"

	"github.com/e2b-dev/infra/packages/orchestrator/internal/consul"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/dns"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"go.opentelemetry.io/otel"
)

func MockInstance(envID, instanceID string, dns *dns.DNS, keepAlive time.Duration) {
	ctx, cancel := context.WithTimeout(context.WithValue(context.Background(), telemetry.DebugID, instanceID), time.Second*10)
	defer cancel()

	tracer := otel.Tracer(fmt.Sprintf("instance-%s", instanceID))
	childCtx, _ := tracer.Start(ctx, "mock-instance")

	consulClient, err := consul.New(childCtx)

	networkPool := make(chan IPSlot, 1)

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				ips, err := NewSlot(ctx, tracer, consulClient)
				if err != nil {
					fmt.Printf("failed to create network: %v\n", err)
					continue
				}

				err = ips.CreateNetwork(ctx, tracer)
				if err != nil {
					ips.Release(ctx, tracer, consulClient)

					fmt.Printf("failed to create network: %v\n", err)
					continue
				}

				networkPool <- *ips
			}
		}
	}()

	instance, err := NewSandbox(
		childCtx,
		tracer,
		consulClient,
		dns,
		networkPool,
		&orchestrator.SandboxConfig{
			TemplateID:         envID,
			FirecrackerVersion: "v1.7.0-dev_8bb88311",
			KernelVersion:      "vmlinux-5.10.186",
			TeamID:             "test-team",
			BuildID:            "",
			HugePages:          true,
			MaxInstanceLength:  1,
			SandboxID:          instanceID,
		},
		"trace-test-1",
	)
	if err != nil {
		panic(err)
	}

	fmt.Println("[Sandbox is running]")

	time.Sleep(keepAlive)

	defer instance.CleanupAfterFCStop(childCtx, tracer, consulClient, dns, instanceID)

	instance.Stop(childCtx, tracer)
}

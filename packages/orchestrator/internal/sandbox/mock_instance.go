package sandbox

import (
	"context"
	"fmt"
	"time"

	"github.com/e2b-dev/infra/packages/orchestrator/internal/consul"

	"go.opentelemetry.io/otel"

	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func MockInstance(envID, instanceID string, dns *DNS, keepAlive time.Duration) {
	ctx, cancel := context.WithTimeout(context.WithValue(context.Background(), telemetry.DebugID, instanceID), time.Second*10)
	defer cancel()

	tracer := otel.Tracer(fmt.Sprintf("instance-%s", instanceID))
	childCtx, _ := tracer.Start(ctx, "mock-instance")

	consulClient, err := consul.New(childCtx)

	instance, err := NewSandbox(
		childCtx,
		tracer,
		consulClient,
		dns,
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

	defer instance.CleanupAfterFCStop(childCtx, tracer, consulClient, dns)

	instance.fc.stop(childCtx, tracer)
}

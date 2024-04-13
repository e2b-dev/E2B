package sandbox

import (
	"context"
	"fmt"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/consul"
	"time"

	"go.opentelemetry.io/otel"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func MockInstance(envID, instanceID string, dns *DNS, keepAlive time.Duration) {
	ctx, cancel := context.WithTimeout(context.WithValue(context.Background(), telemetry.DebugID, instanceID), time.Second*30)
	defer cancel()

	tracer := otel.Tracer(fmt.Sprintf("instance-%s", instanceID))
	childCtx, _ := tracer.Start(ctx, "mock-instance")

	consulClient, err := consul.New(childCtx)

	instance, err := New(
		childCtx,
		tracer,
		consulClient,
		&InstanceConfig{
			TemplateID:            envID,
			SandboxID:             instanceID,
			TraceID:               "test",
			TeamID:                "test",
			KernelVersion:         "vmlinux-5.10.186",
			KernelMountDir:        "/fc-vm",
			KernelsDir:            "/fc-kernels",
			KernelName:            "vmlinux.bin",
			UFFDBinaryPath:        "/fc-versions/v1.7.0-dev_8bb88311/uffd",
			HugePages:             true,
			FirecrackerBinaryPath: "/fc-versions/v1.7.0-dev_8bb88311/firecracker",
		},
		dns,
		nil,
	)
	if err != nil {
		panic(err)
	}

	fmt.Println("[Sandbox is running]")

	time.Sleep(keepAlive)

	defer instance.CleanupAfterFCStop(childCtx, tracer, consulClient, dns)

	err = instance.FC.Stop(childCtx, tracer)
	if err != nil {
		panic(err)
	}
}

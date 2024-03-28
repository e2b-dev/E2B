package instance

import (
	"context"
	"fmt"
	"time"

	"github.com/txn2/txeh"
	"go.opentelemetry.io/otel"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func MockInstance(envID, instanceID, consulToken string, keepAlive time.Duration) {
	ctx, cancel := context.WithTimeout(context.WithValue(context.Background(), telemetry.DebugID, instanceID), time.Minute*3)
	defer cancel()

	tracer := otel.Tracer(fmt.Sprintf("instance-%s", instanceID))
	childCtx, _ := tracer.Start(ctx, "mock-instance")

	hosts, err := txeh.NewHostsDefault()
	if err != nil {
		panic("Failed to initialize etc hosts handler")
	}

	instance, err := NewInstance(
		childCtx,
		tracer,
		&InstanceConfig{
			EnvID:                 envID,
			AllocID:               "test",
			InstanceID:            instanceID,
			TraceID:               "test",
			TeamID:                "test",
			ConsulToken:           consulToken,
			LogsProxyAddress:      "",
			NodeID:                "testtesttest",
			EnvsDisk:              "/mnt/disks/fc-envs/v1",
			KernelVersion:         "vmlinux-5.10.186",
			KernelMountDir:        "/fc-vm",
			KernelsDir:            "/fc-kernels",
			KernelName:            "vmlinux.bin",
			UFFDBinaryPath:        "/fc-versions/v1.7.0-dev_8bb88311/uffd",
			HugePages:             true,
			FirecrackerBinaryPath: "/fc-versions/v1.7.0-dev_8bb88311/firecracker",
		},
		hosts,
	)
	if err != nil {
		panic(err)
	}

	fmt.Println("[Instance is running]")

	time.Sleep(keepAlive)

	defer instance.CleanupAfterFCStop(childCtx, tracer, hosts)

	err = instance.FC.Stop(childCtx, tracer)
	if err != nil {
		panic(err)
	}
}

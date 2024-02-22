package instance

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/txn2/txeh"
	"go.opentelemetry.io/otel"
)

func MockInstance(envID, instanceID string) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute*3)
	defer cancel()

	tracer := otel.Tracer("test")

	hosts, err := txeh.NewHostsDefault()
	if err != nil {
		panic("Failed to initialize etc hosts handler")
	}

	instance, err := NewInstance(
		ctx,
		tracer,
		&InstanceConfig{
			EnvID:                 envID,
			AllocID:               "test",
			InstanceID:            instanceID,
			TraceID:               "test",
			TeamID:                "test",
			ConsulToken:           os.Getenv("CONSUL_TOKEN"),
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

	defer instance.CleanupAfterFCStop(ctx, tracer, hosts)

	err = instance.FC.Stop(ctx, tracer)
	if err != nil {
		panic(err)
	}
}

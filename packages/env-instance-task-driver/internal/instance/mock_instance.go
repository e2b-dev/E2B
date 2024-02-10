package instance

import (
	"context"
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
			EnvID:            envID,
			AllocID:          "test",
			InstanceID:       instanceID,
			TraceID:          "test",
			TeamID:           "test",
			ConsulToken:      os.Getenv("CONSUL_TOKEN"),
			LogsProxyAddress: "",
			NodeID:           "testtesttest",
			EnvsDisk:         "/mnt/disks/fc-envs/v1",
			KernelVersion:    "5.10.186",
			KernelMountDir:   "/fc-vm",
			KernelsDir:       "/fc-kernels",
			KernelName:       "vmlinux.bin",
		},
		hosts,
	)
	if err != nil {
		panic(err)
	}

	instance.CleanupAfterFCStop(ctx, tracer, hosts)
}

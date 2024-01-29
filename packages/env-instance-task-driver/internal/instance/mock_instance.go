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

	consulToken := os.Getenv("CONSUL_TOKEN")
	envsDisk := "/mnt/disks/fc-envs/v1"

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
			ConsulToken:      consulToken,
			LogsProxyAddress: "",
			NodeID:           "testtesttest",
			EnvsDisk:         envsDisk,
		},
		hosts,
	)

	if err != nil {
		panic(err)
	}

	instance.CleanupAfterFCStop(ctx, tracer, hosts)
}

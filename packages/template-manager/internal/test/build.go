package test

import (
	"bytes"
	"context"
	"time"

	"github.com/docker/docker/client"
	docker "github.com/fsouza/go-dockerclient"
	"go.opentelemetry.io/otel"

	"github.com/e2b-dev/infra/packages/template-manager/internal/build"
)

func Build(templateID, buildID string) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute*3)
	defer cancel()

	tracer := otel.Tracer("test")

	dockerClient, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		panic(err)
	}

	legacyClient, err := docker.NewClientFromEnv()
	if err != nil {
		panic(err)
	}

	var buf bytes.Buffer
	e := build.Env{
		BuildID:               buildID,
		EnvID:                 templateID,
		VCpuCount:             2,
		MemoryMB:              256,
		StartCmd:              "",
		KernelVersion:         "vmlinux-5.10.186",
		DiskSizeMB:            512,
		FirecrackerBinaryPath: "/fc-versions/v1.7.0-dev_8bb88311/firecracker",
		BuildLogsWriter:       &buf,
		HugePages:             true,
	}

	err = e.Build(ctx, tracer, dockerClient, legacyClient)
	if err != nil {
		panic(err)
	}
}

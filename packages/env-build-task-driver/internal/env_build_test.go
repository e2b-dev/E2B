package internal

import (
	"context"
	"testing"

	"github.com/docker/docker/client"
	"go.opentelemetry.io/otel"

	_ "embed"

	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/env"
)

//go:embed test-provision-env.ubuntu.sh
var provisionEnvScriptFile string

func TestBuildEnv(t *testing.T) {
	ctx := context.Background()

	tracer := otel.Tracer("test")

	client, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		t.Fatal(err)
	}

	contextsPath := "/mnt/disks/docker-contexts/v1"
	registry := "us-central1-docker.pkg.dev/e2b-prod/custom-environments"
	envsPath := "/mnt/disks/fc-envs/v1"
	kernelImagePath := "/fc-vm/vmlinux.bin"
	firecrackerBinaryPath := "/usr/bin/firecracker"
	envsPipelinePath := "/mnt/disks/envs-pipeline"

	e := env.Env{
		BuildID:               "testing-build-id",
		EnvID:                 "testing-env-id",
		EnvsPath:              envsPath,
		VCpuCount:             1,
		MemoryMB:              512,
		DockerContextsPath:    contextsPath,
		DockerRegistry:        registry,
		KernelImagePath:       kernelImagePath,
		DiskSizeMB:            512,
		FirecrackerBinaryPath: firecrackerBinaryPath,
		ProvisionScript:       provisionEnvScriptFile,
		EnvsPipelinePath:      envsPipelinePath,
	}

	err = e.Initialize(ctx, tracer)
	if err != nil {
		t.Fatal(err)
	}
	defer e.Cleanup(ctx, tracer)

	rootfs, err := env.NewRootfs(ctx, tracer, &e, client)
	if err != nil {
		t.Fatal(err)
	}

	network, err := env.NewFCNetwork(ctx, tracer, &e)
	if err != nil {
		t.Fatal(err)
	}
	defer network.Cleanup(ctx, tracer)

	snapshot, err := env.NewSnapshot(ctx, tracer, &e, network, rootfs)
	if err != nil {
		t.Fatal(err)
	}
	defer snapshot.Cleanup(ctx, tracer)

	err = e.MoveSnapshotToEnvDir(ctx, tracer)
	if err != nil {
		t.Fatal(err)
	}
}

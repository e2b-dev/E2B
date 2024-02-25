package instance

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/KarpelesLab/reflink"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const (
	BuildIDName  = "build_id"
	RootfsName   = "rootfs.ext4"
	SnapfileName = "snapfile"
	MemfileName  = "memfile"

	BuildDirName        = "builds"
	EnvInstancesDirName = "env-instances"
)

type InstanceFiles struct {
	EnvPath      string
	BuildDirPath string

	EnvInstancePath string
	SocketPath      string

	KernelDirPath      string
	KernelMountDirPath string

	FirecrackerBinaryPath string
}

func newInstanceFiles(
	ctx context.Context,
	tracer trace.Tracer,
	slot *IPSlot,
	envID,
	envsDisk,
	kernelVersion,
	kernelsDir,
	kernelMountDir,
	kernelName,
	firecrackerBinaryPath string,
) (*InstanceFiles, error) {
	childCtx, childSpan := tracer.Start(ctx, "create-env-instance",
		trace.WithAttributes(
			attribute.String("env.id", envID),
			attribute.String("envs_disk", envsDisk),
		),
	)
	defer childSpan.End()

	envPath := filepath.Join(envsDisk, envID)
	envInstancePath := filepath.Join(envPath, EnvInstancesDirName, slot.InstanceID)

	err := os.MkdirAll(envInstancePath, 0o777)
	if err != nil {
		telemetry.ReportError(childCtx, err)
	}

	// Mount overlay
	buildIDPath := filepath.Join(envPath, BuildIDName)

	data, err := os.ReadFile(buildIDPath)
	if err != nil {
		return nil, fmt.Errorf("failed reading build id for the env %s: %w", envID, err)
	}

	buildID := string(data)
	buildDirPath := filepath.Join(envPath, BuildDirName, buildID)

	mkdirErr := os.MkdirAll(buildDirPath, 0o777)
	if mkdirErr != nil {
		telemetry.ReportError(childCtx, err)
	}

	err = reflink.Always(
		filepath.Join(envPath, "rootfs.ext4"),
		filepath.Join(envInstancePath, "rootfs.ext4"),
	)
	if err != nil {
		errMsg := fmt.Errorf("error creating reflinked rootfs: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, errMsg
	}

	// Create socket
	socketPath, sockErr := getSocketPath(slot.InstanceID)
	if sockErr != nil {
		errMsg := fmt.Errorf("error getting socket path: %w", sockErr)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}

	// Create kernel path
	kernelPath := filepath.Join(kernelsDir, kernelVersion)

	childSpan.SetAttributes(
		attribute.String("instance.env_instance_path", envInstancePath),
		attribute.String("instance.build.dir_path", buildDirPath),
		attribute.String("instance.env_path", envPath),
		attribute.String("instance.kernel.mount_path", filepath.Join(kernelMountDir, kernelName)),
		attribute.String("instance.kernel.path", filepath.Join(kernelPath, kernelName)),
		attribute.String("instance.firecracker.path", firecrackerBinaryPath),
	)

	return &InstanceFiles{
		EnvInstancePath:       envInstancePath,
		BuildDirPath:          buildDirPath,
		EnvPath:               envPath,
		SocketPath:            socketPath,
		KernelDirPath:         kernelPath,
		KernelMountDirPath:    kernelMountDir,
		FirecrackerBinaryPath: firecrackerBinaryPath,
	}, nil
}

func (env *InstanceFiles) Cleanup(
	ctx context.Context,
	tracer trace.Tracer,
) error {
	childCtx, childSpan := tracer.Start(ctx, "cleanup-env-instance",
		trace.WithAttributes(
			attribute.String("instance.env_instance_path", env.EnvInstancePath),
			attribute.String("instance.build_dir_path", env.BuildDirPath),
			attribute.String("instance.env_path", env.EnvPath),
		),
	)
	defer childSpan.End()

	err := os.RemoveAll(env.EnvInstancePath)
	if err != nil {
		errMsg := fmt.Errorf("error deleting env instance files: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		// TODO: Check the socket?
		telemetry.ReportEvent(childCtx, "removed all env instance files")
	}

	// Remove socket
	err = os.Remove(env.SocketPath)
	if err != nil {
		errMsg := fmt.Errorf("error deleting socket: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "removed socket")
	}

	return nil
}

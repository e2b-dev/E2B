package env

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/slot"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"

	"github.com/KarpelesLab/reflink"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const (
	BuildIDName  = "build_id"
	RootfsName   = "rootfs.ext4"
	SnapfileName = "snapfile"
	MemfileName  = "memfile"

	BuildDirName        = "builds"
	EnvInstancesDirName = "env-instances"
)

type InstanceFilesystem struct {
	BuildDirPath    string
	EnvPath         string
	EnvInstancePath string
}

func New(
	ctx context.Context,
	slot *slot.IPSlot,
	envID string,
	fcEnvsDisk string,
	tracer trace.Tracer,
) (*InstanceFilesystem, error) {
	childCtx, childSpan := tracer.Start(ctx, "create-env-instance",
		trace.WithAttributes(
			attribute.String("env.id", envID),
			attribute.String("envs_disk", fcEnvsDisk),
		),
	)
	defer childSpan.End()

	envPath := filepath.Join(fcEnvsDisk, envID)
	envInstancePath := filepath.Join(envPath, EnvInstancesDirName, slot.InstanceID)

	err := os.MkdirAll(envInstancePath, 0o777)
	if err != nil {
		telemetry.ReportError(childCtx, err)
	}

	// Mount overlay
	buildIDPath := filepath.Join(envPath, BuildIDName)

	data, err := os.ReadFile(buildIDPath)
	if err != nil {
		return nil, fmt.Errorf("failed reading build id for the code snippet %s: %w", envID, err)
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
		errMsg := fmt.Errorf("error creating reflinked rootfs %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return nil, errMsg
	}

	childSpan.SetAttributes(
		attribute.String("instance.env_instance_path", envInstancePath),
		attribute.String("instance.build.dir_path", buildDirPath),
		attribute.String("instance.env_path", envPath),
	)

	return &InstanceFilesystem{
		EnvInstancePath: envInstancePath,
		BuildDirPath:    buildDirPath,
		EnvPath:         envPath,
	}, nil
}

func (env *InstanceFilesystem) Delete(
	ctx context.Context,
	tracer trace.Tracer,
) error {
	childCtx, childSpan := tracer.Start(ctx, "delete-env-instance",
		trace.WithAttributes(
			attribute.String("instance.env_instance_path", env.EnvInstancePath),
			attribute.String("instance.build_dir_path", env.BuildDirPath),
			attribute.String("instance.env_path", env.EnvPath),
		),
	)
	defer childSpan.End()

	err := os.RemoveAll(env.EnvInstancePath)
	if err != nil {
		errMsg := fmt.Errorf("error deleting env instance files %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	}

	return nil
}

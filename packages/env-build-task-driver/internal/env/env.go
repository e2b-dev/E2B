package env

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"go.opentelemetry.io/otel/trace"

	"github.com/docker/docker/client"

	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/telemetry"
)

const (
	buildIDName  = "build_id"
	rootfsName   = "rootfs.ext4"
	snapfileName = "snapfile"
	memfileName  = "memfile"

	buildDirName = "builds"
)

type Env struct {
	// Unique ID of the env.
	EnvID string
	// Unique ID of the build - this is used to distinguish builds of the same env that can start simultaneously.
	BuildID string

	// Path to the directory where all envs are stored.
	EnvsPath string

	// Path to the directory where all docker contexts are stored. This directory is a FUSE mounted bucket where the contexts were uploaded.
	DockerContextsPath string

	// Docker registry where the docker images are uploaded for archivation/caching.
	DockerRegistry string

	// Path to where the kernel image is stored.
	KernelImagePath string

	// Path to the firecracker binary.
	FirecrackerBinaryPath string

	// Provision script to run to set necessary things in the env.
	ProvisionScript string

	// Path to the directory where files for the envs pipeline are stored.
	EnvsPipelinePath string

	EnvdName        string
	ContextFileName string

	// The number of vCPUs to allocate to the VM.
	VCpuCount int64

	// The amount of RAM memory to allocate to the VM, in MiB.
	MemoryMB int64

	// The amount of disk memory to allocate to the VM, in MiB.
	DiskSizeMB int64
}

// Path to the envd.
func (e *Env) EnvdPath() string {
	return filepath.Join(e.EnvsPipelinePath, e.EnvdName)
}

// Path to the docker context.
func (e *Env) DockerContextPath() string {
	return filepath.Join(e.DockerContextsPath, e.EnvID, e.BuildID, e.ContextFileName)
}

// Docker tag of the docker image for this env.
func (e *Env) DockerTag() string {
	return e.DockerRegistry + "/" + e.EnvID
}

// Path to the directory where the temporary files for the build are stored.
func (e *Env) tmpBuildDirPath() string {
	return filepath.Join(e.envDirPath(), buildDirName, e.BuildID)
}

// Path to the file where the build ID is stored. This is used for setting up the namespaces when starting the FC snapshot for this build/env.
func (e *Env) tmpBuildIDFilePath() string {
	return filepath.Join(e.tmpBuildDirPath(), buildIDName)
}

func (e *Env) tmpRootfsPath() string {
	return filepath.Join(e.tmpBuildDirPath(), rootfsName)
}

func (e *Env) tmpMemfilePath() string {
	return filepath.Join(e.tmpBuildDirPath(), memfileName)
}

func (e *Env) tmpSnapfilePath() string {
	return filepath.Join(e.tmpBuildDirPath(), snapfileName)
}

// Path to the directory where the env is stored.
func (e *Env) envDirPath() string {
	return filepath.Join(e.EnvsPath, e.EnvID)
}

func (e *Env) envBuildIDFilePath() string {
	return filepath.Join(e.envDirPath(), buildIDName)
}

func (e *Env) envRootfsPath() string {
	return filepath.Join(e.envDirPath(), rootfsName)
}

func (e *Env) envMemfilePath() string {
	return filepath.Join(e.envDirPath(), memfileName)
}

func (e *Env) envSnapfilePath() string {
	return filepath.Join(e.envDirPath(), snapfileName)
}

func (e *Env) Build(ctx context.Context, tracer trace.Tracer, docker *client.Client) error {
	childCtx, childSpan := tracer.Start(ctx, "build")
	defer childSpan.End()

	err := e.initialize(childCtx, tracer)
	if err != nil {
		return fmt.Errorf("error initializing directories for building env '%s' during build '%s': %w", e.EnvID, e.BuildID, err)
	}

	defer e.Cleanup(childCtx, tracer)

	rootfs, err := NewRootfs(childCtx, tracer, e, docker)
	if err != nil {
		return fmt.Errorf("error creating rootfs for env '%s' during build '%s': %w", e.EnvID, e.BuildID, err)
	}

	network, err := NewFCNetwork(childCtx, tracer, e)
	if err != nil {
		return fmt.Errorf("error network setup for FC while building env '%s' during build '%s': %w", e.EnvID, e.BuildID, err)
	}

	defer network.Cleanup(childCtx, tracer)

	_, err = NewSnapshot(childCtx, tracer, e, network, rootfs)
	if err != nil {
		return fmt.Errorf("error snapshot for env '%s' during build '%s': %w", e.EnvID, e.BuildID, err)
	}

	err = e.MoveToEnvDir(childCtx, tracer)
	if err != nil {
		return fmt.Errorf("error moving env files to their final destination during while building env '%s' during build '%s': %w", e.EnvID, e.BuildID, err)
	}

	return nil
}

func (e *Env) initialize(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "initialize")
	defer childSpan.End()

	var err error
	defer func() {
		if err != nil {
			e.Cleanup(childCtx, tracer)
		}
	}()

	err = os.MkdirAll(e.tmpBuildDirPath(), 0o777)
	if err != nil {
		errMsg := fmt.Errorf("error creating tmp build dir: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "created tmp build dir")

	err = os.WriteFile(e.tmpBuildIDFilePath(), []byte(e.BuildID), 0o644)
	if err != nil {
		errMsg := fmt.Errorf("error writing build ID file: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "wrote build ID")

	return nil
}

func (e *Env) MoveToEnvDir(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "move-to-env-dir")
	defer childSpan.End()

	err := os.Rename(e.tmpSnapfilePath(), e.envSnapfilePath())
	if err != nil {
		errMsg := fmt.Errorf("error moving snapshot file: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "moved snapshot file")

	err = os.Rename(e.tmpMemfilePath(), e.envMemfilePath())
	if err != nil {
		errMsg := fmt.Errorf("error moving memfile: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "moved memfile")

	err = os.Rename(e.tmpRootfsPath(), e.envRootfsPath())
	if err != nil {
		errMsg := fmt.Errorf("error moving rootfs: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "moved rootfs")

	err = os.Rename(e.tmpBuildIDFilePath(), e.envBuildIDFilePath())
	if err != nil {
		errMsg := fmt.Errorf("error moving build ID: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "moved build ID")

	return nil
}

func (e *Env) Cleanup(ctx context.Context, tracer trace.Tracer) {
	childCtx, childSpan := tracer.Start(ctx, "cleanup")
	defer childSpan.End()

	err := os.RemoveAll(e.tmpBuildDirPath())
	if err != nil {
		errMsg := fmt.Errorf("error cleaning up env files %w", err)
		telemetry.ReportError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "cleaned up env files")
	}
}

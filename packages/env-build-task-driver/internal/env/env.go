package env

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/telemetry"
	"go.opentelemetry.io/otel/trace"
)

const (
	buildIDName  = "build_id"
	rootfsName   = "rootfs.ext4"
	snapfileName = "snapfile"
	memfileName  = "memfile"

	buildDirName = "builds"
	mntDirName   = "mnt"
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

	// The number of vCPUs to allocate to the VM.
	VCpuCount int64

	// The amount of RAM memory to allocate to the VM, in MiB.
	MemoryMB int64

	// The amount of disk memory to allocate to the VM, in MiB.
	DiskSizeMB int64
}

// Path to the directory where the build files are mounted.
func (e *Env) tmpBuildMountDirPath() string {
	return filepath.Join(e.tmpBuildDirPath(), mntDirName)
}

// Path to the docker context.
func (e *Env) DockerContextPath() string {
	return filepath.Join(e.DockerContextsPath, e.EnvID)
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

func (e *Env) Initialize(ctx context.Context, tracer trace.Tracer) error {
	// We don't need to create build dir because by creating the build mountdir we create the build dir.

	var err error

	defer func() {
		if err != nil {
			cleanupErr := e.Cleanup()
			if cleanupErr != nil {
				errMsg := fmt.Errorf("error cleaning up env %v", cleanupErr)
				telemetry.ReportError(ctx, errMsg)
			}
		}
	}()

	err = os.MkdirAll(e.tmpBuildMountDirPath(), 0777)
	if err != nil {
		return err
	}

	err = os.WriteFile(e.tmpBuildIDFilePath(), []byte(e.BuildID), 0777)
	if err != nil {
		return err
	}

	return nil
}

func (e *Env) MoveSnapshotToEnvDir() error {
	err := os.Rename(e.tmpSnapfilePath(), e.envSnapfilePath())
	if err != nil {
		return nil
	}
	err = os.Rename(e.tmpMemfilePath(), e.envMemfilePath())
	if err != nil {
		return nil
	}
	err = os.Rename(e.tmpRootfsPath(), e.envRootfsPath())
	if err != nil {
		return nil
	}
	err = os.Rename(e.tmpBuildIDFilePath(), e.envBuildIDFilePath())
	if err != nil {
		return nil
	}

	return nil
}

func (e *Env) Cleanup() error {
	return os.RemoveAll(e.tmpBuildDirPath())
}

package env

import (
	"context"
	_ "embed"
	"github.com/docker/docker/client"
	docker "github.com/fsouza/go-dockerclient"
	"go.opentelemetry.io/otel/trace"
	"path/filepath"
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

	// Path to the directory where all envs are stored.
	EnvsDiskPath string

	// Path to the directory where all docker contexts are stored. This directory is a FUSE mounted bucket where the contexts were uploaded.
	DockerContextsPath string

	// Docker registry where the docker images are uploaded for archivation/caching.
	DockerRegistry string

	// Path to where the kernel image is stored.
	KernelImagePath string

	// Path to the firecracker binary.
	FirecrackerBinaryPath string

	// Path to the envd.
	EnvdPath string

	ContextFileName string

	// Google service account JSON secret base64 encoded.
	GoogleServiceAccountBase64 string
}

// Path to the docker context.
func (e *Env) DockerContextFolder() string {
	return filepath.Join(e.DockerContextsPath, e.EnvID)
}

// Path to the directory where the env is stored.
func (e *Env) envDirPath() string {
	return filepath.Join(e.EnvsDiskPath, e.EnvID)
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

func (e *Env) Delete(ctx context.Context, tracer trace.Tracer, docker *client.Client, legacyDocker *docker.Client) error {
	//childCtx, childSpan := tracer.Start(ctx, "delete")
	//defer childSpan.End()

	// Rootfs

	// Memfile

	// Snapfile

	// Docker contexts?

	// Docker image?

	return nil
}

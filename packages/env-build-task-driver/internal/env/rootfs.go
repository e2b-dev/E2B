package env

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/Microsoft/hcsshim/ext4/tar2ext4"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/telemetry"
)

const dockerfileName = "Dockerfile"

type Rootfs struct {
	client *client.Client

	Env
}

func NewRootfs(ctx context.Context, tracer trace.Tracer, env *Env, docker *client.Client) (*Rootfs, error) {
	childCtx, childSpan := tracer.Start(ctx, "create-rootfs")
	defer childSpan.End()

	rootfs := &Rootfs{
		client: docker,
		Env:    *env,
	}

	var err error

	defer func() {
		if err != nil {
			rootfs.Cleanup(childCtx, tracer)
		}
	}()

	// TODO: Push to registry later
	err = rootfs.buildDockerImage(childCtx, tracer)
	if err != nil {
		return nil, err
	}
	defer rootfs.cleanupDockerImage(childCtx, tracer)

	err = rootfs.createRootfsFile(childCtx, tracer)
	if err != nil {
		return nil, err
	}

	return rootfs, nil
}

func (r *Rootfs) buildDockerImage(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "build-docker-image")
	defer childSpan.End()

	dockerContextFile, err := os.Open(r.DockerContextPath())
	if err != nil {
		return err
	}
	telemetry.ReportEvent(childCtx, "opened docker context file")
	defer dockerContextFile.Close()

	// TODO: Add timeout via context
	buildResponse, err := r.client.ImageBuild(
		childCtx,
		dockerContextFile,
		types.ImageBuildOptions{
			Context:    dockerContextFile,
			Dockerfile: dockerfileName,
			Remove:     true,
			Tags:       []string{r.dockerTag()},
		},
	)

	// Handle fuse mount

	// TODO: Stream the logs somewhere
	_, err = io.Copy(os.Stdout, buildResponse.Body)
	if err != nil {
		return fmt.Errorf("error copying build response body %w", err)
	}
	telemetry.ReportEvent(childCtx, "copied build response body")

	err = buildResponse.Body.Close()
	if err != nil {
		return fmt.Errorf("error closing build response body %w", err)
	}
	telemetry.ReportEvent(childCtx, "closed build response body")

	return nil
}

func (r *Rootfs) cleanupDockerImage(ctx context.Context, tracer trace.Tracer) {
	_, err := r.client.ImageRemove(ctx, r.dockerTag(), types.ImageRemoveOptions{
		Force:         true,
		PruneChildren: true,
	})
	if err != nil {
		errMsg := fmt.Errorf("error removing image %v", err)
		telemetry.ReportError(ctx, errMsg)
	}
}

func (r *Rootfs) dockerTag() string {
	return r.DockerRegistry + "/" + r.EnvID
}

func (r *Rootfs) createRootfsFile(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "create-rootfs-file")
	defer childSpan.End()

	cont, err := r.client.ContainerCreate(childCtx, &container.Config{
		Image:      r.dockerTag(),
		Entrypoint: []string{"/bin/sh"},
		User:       "root",
		Cmd:        []string{"/provision-env.sh"},
	}, nil, nil, &v1.Platform{}, "")
	if err != nil {
		return fmt.Errorf("error creating container %v", err)
	}
	telemetry.ReportEvent(childCtx, "created container")
	defer func() {
		err = r.client.ContainerRemove(ctx, cont.ID, types.ContainerRemoveOptions{
			Force:         true,
			RemoveLinks:   true,
			RemoveVolumes: true,
		})
		if err != nil {
			errMsg := fmt.Errorf("error removing container %v", err)
			telemetry.ReportError(ctx, errMsg)
		}
	}()

	err = r.client.ContainerStart(childCtx, cont.ID, types.ContainerStartOptions{})
	if err != nil {
		return fmt.Errorf("error starting container %v", err)
	}
	telemetry.ReportEvent(childCtx, "started container")

	wait, errWait := r.client.ContainerWait(childCtx, cont.ID, container.WaitConditionNextExit)
	select {
	case err := <-errWait:
		if err != nil {
			return fmt.Errorf("error waiting for container %v", err)
		}
	case <-wait:
	}
	telemetry.ReportEvent(childCtx, "waited for container exit")

	exitResponse := <-wait
	if exitResponse.Error != nil {
		return fmt.Errorf("error waiting for container %v", exitResponse.Error)
	}

	containerReader, stat, err := r.client.CopyFromContainer(childCtx, cont.ID, "/")
	if err != nil {
		return fmt.Errorf("error copying from container %v", err)
	}
	telemetry.ReportEvent(childCtx, "started copying from container")

	rootfsFile, err := os.Create(r.tmpRootfsPath())
	if err != nil {
		return fmt.Errorf("error creating rootfs file %v", err)
	}
	telemetry.ReportEvent(childCtx, "created rootfs file")

	// In bytes
	rootfsSize := stat.Size + r.DiskSizeMB<<20

	err = rootfsFile.Truncate(rootfsSize)
	if err != nil {
		return fmt.Errorf("error truncating rootfs file %v", err)
	}
	telemetry.ReportEvent(childCtx, "truncated rootfs file")

	err = tar2ext4.ConvertTarToExt4(containerReader, rootfsFile, tar2ext4.MaximumDiskSize(rootfsSize))
	if err != nil {
		return fmt.Errorf("error converting tar to ext4 %v", err)
	}
	telemetry.ReportEvent(childCtx, "converted container tar to ext4")

	return nil
}

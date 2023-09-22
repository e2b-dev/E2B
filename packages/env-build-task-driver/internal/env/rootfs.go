package env

import (
	"archive/tar"
	"bytes"
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

const (
	dockerfileName = "Dockerfile"
	envdRootfsPath = "/usr/bin/envd"
)

type Rootfs struct {
	client *client.Client

	env *Env
}

func NewRootfs(ctx context.Context, tracer trace.Tracer, env *Env, docker *client.Client) (*Rootfs, error) {
	childCtx, childSpan := tracer.Start(ctx, "create-rootfs")
	defer childSpan.End()

	rootfs := &Rootfs{
		client: docker,
		env:    env,
	}

	err := rootfs.buildDockerImage(childCtx, tracer)
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

	// File should be automatically closed by the docker image build
	dockerContextFile, err := os.Open(r.env.DockerContextPath())
	if err != nil {
		return err
	}
	defer func() {
		closeErr := dockerContextFile.Close()
		if closeErr != nil {
			errMsg := fmt.Errorf("error closing docker context file %w", closeErr)
			telemetry.ReportError(childCtx, errMsg)
		}
	}()
	telemetry.ReportEvent(childCtx, "opened docker context file")

	buildResponse, err := r.client.ImageBuild(
		childCtx,
		dockerContextFile,
		types.ImageBuildOptions{
			Dockerfile: dockerfileName,
			Remove:     true,
			Tags:       []string{r.dockerTag()},
		},
	)

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
	telemetry.ReportEvent(ctx, "removed image")
}

func (r *Rootfs) dockerTag() string {
	return r.env.DockerRegistry + "/" + r.env.EnvID
}

func (r *Rootfs) createRootfsFile(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "create-rootfs-file")
	defer childSpan.End()

	cont, err := r.client.ContainerCreate(childCtx, &container.Config{
		Image:        r.dockerTag(),
		Entrypoint:   []string{"/bin/sh", "-c"},
		User:         "root",
		Cmd:          []string{r.env.ProvisionScript},
		Tty:          true,
		AttachStdout: true,
		AttachStderr: true,
	}, nil, nil, &v1.Platform{}, "")
	if err != nil {
		return fmt.Errorf("error creating container %v", err)
	}
	telemetry.ReportEvent(childCtx, "created container")
	defer func() {
		err = r.client.ContainerRemove(ctx, cont.ID, types.ContainerRemoveOptions{
			Force: true,
		})
		if err != nil {
			errMsg := fmt.Errorf("error removing container %v", err)
			telemetry.ReportError(ctx, errMsg)
		}
	}()

	envdFile, err := os.Open("/usr/bin/ping")
	if err != nil {
		return fmt.Errorf("error opening envd file %v", err)
	}
	defer envdFile.Close()
	telemetry.ReportEvent(childCtx, "opened envd file")

	envdStat, err := envdFile.Stat()
	if err != nil {
		return fmt.Errorf("error statting envd file %v", err)
	}
	telemetry.ReportEvent(childCtx, "statted envd file")

	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	hdr := &tar.Header{
		Name: envdRootfsPath, // The name of the file in the tar archive
		Mode: 0o777,
		Size: envdStat.Size(),
	}

	err = tw.WriteHeader(hdr)
	if err != nil {
		return fmt.Errorf("error writing tar header %v", err)
	}
	telemetry.ReportEvent(childCtx, "wrote tar header")

	_, err = io.Copy(tw, envdFile)
	if err != nil {
		return fmt.Errorf("error copying envd to tar %v", err)
	}
	telemetry.ReportEvent(childCtx, "copied envd to tar")

	err = tw.Close()
	if err != nil {
		return fmt.Errorf("error closing tar writer %v", err)
	}
	telemetry.ReportEvent(childCtx, "closed tar writer")

	// Copy envd to the container
	err = r.client.CopyToContainer(childCtx, cont.ID, "/", &buf, types.CopyToContainerOptions{
		AllowOverwriteDirWithFile: true,
	})
	if err != nil {
		return fmt.Errorf("error copying envd to container %v", err)
	}
	telemetry.ReportEvent(childCtx, "copied envd to container")

	go func() {
		data, err := r.client.ContainerLogs(childCtx, cont.ID, types.ContainerLogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Timestamps: false,
			Follow:     true,
			Tail:       "40",
		})
		if err != nil {
			errMsg := fmt.Errorf("error getting container logs %w", err)
			telemetry.ReportError(childCtx, errMsg)
			return
		}
		telemetry.ReportEvent(childCtx, "got container logs")
		defer func() {
			closeErr := data.Close()
			if closeErr != nil {
				errMsg := fmt.Errorf("error closing container logs %w", closeErr)
				telemetry.ReportError(childCtx, errMsg)
			}
		}()

		_, err = io.Copy(os.Stdout, data)
		if err != nil {
			errMsg := fmt.Errorf("error copying container logs %v", err)
			telemetry.ReportError(childCtx, errMsg)
		}
	}()

	err = r.client.ContainerStart(childCtx, cont.ID, types.ContainerStartOptions{})
	if err != nil {
		return fmt.Errorf("error starting container %v", err)
	}
	telemetry.ReportEvent(childCtx, "started container")

	wait, errWait := r.client.ContainerWait(childCtx, cont.ID, container.WaitConditionNotRunning)
	select {
	case waitErr := <-errWait:
		if waitErr != nil {
			return fmt.Errorf("error waiting for container %v", waitErr)
		}
	case response := <-wait:
		if response.Error != nil {
			return fmt.Errorf("error waiting for container - code %d: %s", response.StatusCode, response.Error.Message)
		}
	}
	telemetry.ReportEvent(childCtx, "waited for container exit")

	containerReader, stat, err := r.client.CopyFromContainer(childCtx, cont.ID, "/")
	if err != nil {
		return fmt.Errorf("error copying from container %v", err)
	}
	telemetry.ReportEvent(childCtx, "started copying from container")

	rootfsFile, err := os.Create(r.env.tmpRootfsPath())
	if err != nil {
		return fmt.Errorf("error creating rootfs file %v", err)
	}
	telemetry.ReportEvent(childCtx, "created rootfs file")

	// In bytes
	rootfsSize := stat.Size + r.env.DiskSizeMB<<20

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

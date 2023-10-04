package env

import (
	"archive/tar"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"

	"github.com/Microsoft/hcsshim/ext4/tar2ext4"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	v1 "github.com/opencontainers/image-spec/specs-go/v1"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/env-build-task-driver/internal/telemetry"
)

const (
	dockerfileName = "Dockerfile"
	envdRootfsPath = "/usr/bin/envd"
	toMBShift      = 20
	maxRootfsSize  = 5000 << toMBShift
)

type Rootfs struct {
	client *client.Client

	env *Env
}

func NewRootfs(ctx context.Context, tracer trace.Tracer, env *Env, docker *client.Client) (*Rootfs, error) {
	childCtx, childSpan := tracer.Start(ctx, "new-rootfs")
	defer childSpan.End()

	rootfs := &Rootfs{
		client: docker,
		env:    env,
	}

	err := rootfs.buildDockerImage(childCtx, tracer)
	if err != nil {
		errMsg := fmt.Errorf("error building docker image %w", err)

		return nil, errMsg
	}

	defer rootfs.cleanupDockerImage(childCtx, tracer)

	err = rootfs.createRootfsFile(childCtx, tracer)
	if err != nil {
		errMsg := fmt.Errorf("error creating rootfs file %w", err)

		return nil, errMsg
	}

	return rootfs, nil
}

func (r *Rootfs) buildDockerImage(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "build-docker-image")
	defer childSpan.End()

	dockerContextFile, err := os.Open(r.env.DockerContextPath())
	if err != nil {
		errMsg := fmt.Errorf("error opening docker context file %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "opened docker context file")

	defer func() {
		closeErr := dockerContextFile.Close()
		if closeErr != nil {
			// We can probably disregard 'already closed' error if we are reading file from gcsfuse bucket because gcsfuse files behave this way - they look closed after reading
			errMsg := fmt.Errorf("error closing docker context file (we can probably disregard 'already closed' error if we are reading file from gcsfuse bucket because gcsfuse files behave this way): %w", closeErr)
			telemetry.ReportError(childCtx, errMsg)
		} else {
			telemetry.ReportEvent(childCtx, "closed docker context file")
		}
	}()

	buildCtx, cancel := context.WithCancel(childCtx)
	defer cancel()

	buildResponse, buildErr := r.client.ImageBuild(
		buildCtx,
		dockerContextFile,
		types.ImageBuildOptions{
			Dockerfile: dockerfileName,
			Remove:     true,
			Tags:       []string{r.dockerTag()},
		},
	)
	if buildErr != nil {
		errMsg := fmt.Errorf("error starting docker image build %w", buildErr)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "started docker image build", attribute.String("tag", r.dockerTag()))

	defer func() {
		err = buildResponse.Body.Close()
		if err != nil {
			errMsg := fmt.Errorf("error closing build response body %w", err)
			telemetry.ReportCriticalError(childCtx, errMsg)
		} else {
			telemetry.ReportEvent(childCtx, "closed build response body")
		}
	}()

	decoder := json.NewDecoder(buildResponse.Body)
	for {
		var message map[string]interface{}

		err := decoder.Decode(&message)
		if err == io.EOF {
			break
		} else if err != nil {
			errMsg := fmt.Errorf("error decoding build response %w", err)
			telemetry.ReportCriticalError(childCtx, errMsg)

			return errMsg
		}

		if message["error"] != nil {
			cancel()

			errMsg := fmt.Errorf("error building image: %s", message["error"])
			telemetry.ReportCriticalError(childCtx, errMsg)

			return errMsg
		}

		stream, exists := message["stream"]
		if !exists {
			break
		}

		streamMessage := fmt.Sprintf("%+v", stream.(string))

		telemetry.ReportEvent(childCtx, "docker build stream", attribute.String("stream", streamMessage))
	}

	telemetry.ReportEvent(childCtx, "finished docker image build", attribute.String("tag", r.dockerTag()))

	return nil
}

func (r *Rootfs) cleanupDockerImage(ctx context.Context, tracer trace.Tracer) {
	childCtx, childSpan := tracer.Start(ctx, "cleanup-docker-image")
	defer childSpan.End()

	_, err := r.client.ImageRemove(childCtx, r.dockerTag(), types.ImageRemoveOptions{
		Force:         true,
		PruneChildren: true,
	})
	if err != nil {
		errMsg := fmt.Errorf("error removing image %w", err)
		telemetry.ReportError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "removed image")
	}
}

func (r *Rootfs) dockerTag() string {
	return r.env.DockerRegistry + "/" + r.env.EnvID + ":" + r.env.BuildID
}

func (r *Rootfs) createRootfsFile(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "create-rootfs-file")
	defer childSpan.End()

	cont, err := r.client.ContainerCreate(childCtx, &container.Config{
		Image:        r.dockerTag(),
		Entrypoint:   []string{"/bin/sh", "-c"},
		User:         "root",
		Cmd:          []string{r.env.ProvisionScript()},
		Tty:          true,
		AttachStdout: true,
		AttachStderr: true,
	}, nil, nil, &v1.Platform{}, "")
	if err != nil {
		errMsg := fmt.Errorf("error creating container %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "created container")

	defer func() {
		err = r.client.ContainerRemove(ctx, cont.ID, types.ContainerRemoveOptions{
			Force: true,
		})
		if err != nil {
			errMsg := fmt.Errorf("error removing container %w", err)
			telemetry.ReportError(ctx, errMsg)
		}
	}()

	envdFile, err := os.Open(r.env.EnvdPath)
	if err != nil {
		errMsg := fmt.Errorf("error opening envd file %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "opened envd file")

	defer func() {
		closeErr := envdFile.Close()
		if closeErr != nil {
			errMsg := fmt.Errorf("error closing envd file %w", closeErr)
			telemetry.ReportError(childCtx, errMsg)
		} else {
			telemetry.ReportEvent(childCtx, "closed envd file")
		}
	}()

	envdStat, err := envdFile.Stat()
	if err != nil {
		errMsg := fmt.Errorf("error statting envd file %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "statted envd file")

	pr, pw := io.Pipe()

	tw := tar.NewWriter(pw)

	go func() {
		hdr := &tar.Header{
			Name: envdRootfsPath, // The name of the file in the tar archive
			Mode: 0o777,
			Size: envdStat.Size(),
		}

		err = tw.WriteHeader(hdr)
		if err != nil {
			errMsg := fmt.Errorf("error writing tar header %w", err)
			telemetry.ReportCriticalError(childCtx, errMsg)

			return
		}

		telemetry.ReportEvent(childCtx, "wrote tar header")

		_, err = io.Copy(tw, envdFile)
		if err != nil {
			errMsg := fmt.Errorf("error copying envd to tar %w", err)
			telemetry.ReportCriticalError(childCtx, errMsg)

			return
		}

		telemetry.ReportEvent(childCtx, "copied envd to tar")

		err = tw.Close()
		if err != nil {
			errMsg := fmt.Errorf("error closing tar writer %w", err)
			telemetry.ReportCriticalError(childCtx, errMsg)

			return
		}

		telemetry.ReportEvent(childCtx, "closed tar writer")

		err = pw.Close()
		if err != nil {
			errMsg := fmt.Errorf("error closing pipe %w", err)
			telemetry.ReportCriticalError(childCtx, errMsg)

			return
		}

		telemetry.ReportEvent(childCtx, "closed pipe")
	}()

	// Copy envd to the container
	err = r.client.CopyToContainer(childCtx, cont.ID, "/", pr, types.CopyToContainerOptions{
		AllowOverwriteDirWithFile: true,
	})
	if err != nil {
		errMsg := fmt.Errorf("error copying envd to container %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "copied envd to container")

	go func() {
		anonymousChildCtx, childSpan := tracer.Start(childCtx, "handle-container-logs", trace.WithSpanKind(trace.SpanKindConsumer))
		defer childSpan.End()

		data, err := r.client.ContainerLogs(anonymousChildCtx, cont.ID, types.ContainerLogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Timestamps: false,
			Follow:     true,
			Tail:       "40",
		})
		if err != nil {
			errMsg := fmt.Errorf("error getting container logs %w", err)
			telemetry.ReportError(anonymousChildCtx, errMsg)

			return
		} else {
			telemetry.ReportEvent(anonymousChildCtx, "got container logs")
		}

		defer func() {
			closeErr := data.Close()
			if closeErr != nil {
				errMsg := fmt.Errorf("error closing container logs %w", closeErr)
				telemetry.ReportError(anonymousChildCtx, errMsg)
			} else {
				telemetry.ReportEvent(anonymousChildCtx, "closed container logs")
			}
		}()

		_, err = io.Copy(os.Stdout, data)
		if err != nil {
			errMsg := fmt.Errorf("error copying container logs %w", err)
			telemetry.ReportError(anonymousChildCtx, errMsg)
		} else {
			telemetry.ReportEvent(anonymousChildCtx, "copied container logs")
		}
	}()

	err = r.client.ContainerStart(childCtx, cont.ID, types.ContainerStartOptions{})
	if err != nil {
		errMsg := fmt.Errorf("error starting container %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "started container")

	wait, errWait := r.client.ContainerWait(childCtx, cont.ID, container.WaitConditionNotRunning)
	select {
	case waitErr := <-errWait:
		if waitErr != nil {
			errMsg := fmt.Errorf("error waiting for container %w", waitErr)
			telemetry.ReportCriticalError(childCtx, errMsg)

			return errMsg
		}
	case response := <-wait:
		if response.Error != nil {
			errMsg := fmt.Errorf("error waiting for container - code %d: %s", response.StatusCode, response.Error.Message)
			telemetry.ReportCriticalError(childCtx, errMsg)

			return errMsg
		}
	}

	telemetry.ReportEvent(childCtx, "waited for container exit")

	containerReader, err := r.client.ContainerExport(childCtx, cont.ID)
	if err != nil {
		errMsg := fmt.Errorf("error copying from container %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "started copying from container")

	defer func() {
		containerErr := containerReader.Close()
		if containerErr != nil {
			errMsg := fmt.Errorf("error closing container reader %w", containerErr)
			telemetry.ReportError(childCtx, errMsg)
		} else {
			telemetry.ReportEvent(childCtx, "closed container reader")
		}
	}()

	rootfsFile, err := os.Create(r.env.tmpRootfsPath())
	if err != nil {
		errMsg := fmt.Errorf("error creating rootfs file %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "created rootfs file")

	defer func() {
		rootfsErr := rootfsFile.Close()
		if rootfsErr != nil {
			errMsg := fmt.Errorf("error closing rootfs file %w", rootfsErr)
			telemetry.ReportError(childCtx, errMsg)
		} else {
			telemetry.ReportEvent(childCtx, "closed rootfs file")
		}
	}()

	// This package creates a read-only ext4 filesystem from a tar archive.
	// We need to use another program to make the filesystem writable.
	err = tar2ext4.ConvertTarToExt4(containerReader, rootfsFile, tar2ext4.MaximumDiskSize(maxRootfsSize))
	if err != nil {
		errMsg := fmt.Errorf("error converting tar to ext4 %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "converted container tar to ext4")

	cmd := exec.Command("tune2fs", "-O ^read-only", r.env.tmpRootfsPath())
	// cmd.Stdout = os.Stdout
	err = cmd.Run()
	if err != nil {
		errMsg := fmt.Errorf("error making rootfs file writable %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "made rootfs file writable")

	rootfsStats, err := rootfsFile.Stat()
	if err != nil {
		errMsg := fmt.Errorf("error statting rootfs file %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "statted rootfs file")

	// In bytes
	rootfsSize := rootfsStats.Size() + r.env.DiskSizeMB<<toMBShift

	err = rootfsFile.Truncate(rootfsSize)
	if err != nil {
		errMsg := fmt.Errorf("error truncating rootfs file %w to size of build + defaultDiskSizeMB", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "truncated rootfs file to size of build + defaultDiskSizeMB")

	cmd = exec.Command("resize2fs", r.env.tmpRootfsPath())

	err = cmd.Run()
	if err != nil {
		errMsg := fmt.Errorf("error resizing rootfs file %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "resized rootfs file")

	return nil
}

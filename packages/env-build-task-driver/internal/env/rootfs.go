package env

import (
	"archive/tar"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"

	"github.com/Microsoft/hcsshim/ext4/tar2ext4"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	docker "github.com/fsouza/go-dockerclient"
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
	client       *client.Client
	legacyClient *docker.Client

	env *Env
}

func NewRootfs(ctx context.Context, tracer trace.Tracer, env *Env, docker *client.Client, legacyDocker *docker.Client) (*Rootfs, error) {
	childCtx, childSpan := tracer.Start(ctx, "new-rootfs")
	defer childSpan.End()

	rootfs := &Rootfs{
		client:       docker,
		legacyClient: legacyDocker,
		env:          env,
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

	innerBuildCtx, innerBuildSpan := tracer.Start(buildCtx, "build-docker-image-logs")
	defer innerBuildSpan.End()

	buildOutputWriter := telemetry.NewEventWriter(innerBuildCtx, "docker-build-output")

	err = r.legacyClient.BuildImage(docker.BuildImageOptions{
		Context:      buildCtx,
		Dockerfile:   dockerfileName,
		InputStream:  dockerContextFile,
		OutputStream: buildOutputWriter,
		Name:         r.dockerTag(),
	})
	if err != nil {
		errMsg := fmt.Errorf("error building docker image for env %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
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
		Tty:          false,
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
		anonymousChildCtx, anonymousChildSpan := tracer.Start(childCtx, "handle-container-logs", trace.WithSpanKind(trace.SpanKindConsumer))
		defer anonymousChildSpan.End()

		containerStdoutWriter := telemetry.NewEventWriter(anonymousChildCtx, "stdout")
		containerStderrWriter := telemetry.NewEventWriter(anonymousChildCtx, "stderr")

		err := r.legacyClient.Logs(docker.LogsOptions{
			Stdout:       true,
			Stderr:       true,
			RawTerminal:  false,
			OutputStream: containerStdoutWriter,
			ErrorStream:  containerStderrWriter,
			Context:      childCtx,
			Container:    cont.ID,
			Follow:       true,
			Timestamps:   false,
		})
		if err != nil {
			errMsg := fmt.Errorf("error getting container logs %w", err)
			telemetry.ReportError(anonymousChildCtx, errMsg)
		} else {
			telemetry.ReportEvent(anonymousChildCtx, "setup container logs")
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

	inspection, err := r.client.ContainerInspect(ctx, cont.ID)
	if err != nil {
		errMsg := fmt.Errorf("error inspecting container %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "inspected container")

	if inspection.State.Running {
		errMsg := fmt.Errorf("container is still running")
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	if inspection.State.ExitCode != 0 {
		errMsg := fmt.Errorf("container exited with status %d: %s", inspection.State.ExitCode, inspection.State.Error)
		telemetry.ReportCriticalError(
			childCtx,
			errMsg,
			attribute.Int("exitCode", inspection.State.ExitCode),
			attribute.String("error", inspection.State.Error),
			attribute.Bool("oom", inspection.State.OOMKilled),
		)

		return errMsg
	}

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

	tuneContext, tuneSpan := tracer.Start(childCtx, "tune-rootfs-file-cmd")
	defer tuneSpan.End()

	cmd := exec.CommandContext(tuneContext, "tune2fs", "-O ^read-only", r.env.tmpRootfsPath())

	tuneStdoutWriter := telemetry.NewEventWriter(tuneContext, "stdout")
	cmd.Stdout = tuneStdoutWriter

	tuneStderrWriter := telemetry.NewEventWriter(childCtx, "stderr")
	cmd.Stderr = tuneStderrWriter

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

	resizeContext, resizeSpan := tracer.Start(childCtx, "resize-rootfs-file-cmd")
	defer resizeSpan.End()

	cmd = exec.CommandContext(resizeContext, "resize2fs", r.env.tmpRootfsPath())

	resizeStdoutWriter := telemetry.NewEventWriter(resizeContext, "stdout")
	cmd.Stdout = resizeStdoutWriter

	resizeStderrWriter := telemetry.NewEventWriter(resizeContext, "stderr")
	cmd.Stderr = resizeStderrWriter

	err = cmd.Run()
	if err != nil {
		errMsg := fmt.Errorf("error resizing rootfs file %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "resized rootfs file")

	return nil
}

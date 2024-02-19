package instance

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"github.com/firecracker-microvm/firecracker-go-sdk"
	"github.com/go-openapi/strfmt"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/shared/pkg/fc/client"
	"github.com/e2b-dev/infra/packages/shared/pkg/fc/client/operations"
	"github.com/e2b-dev/infra/packages/shared/pkg/fc/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const fcKillCheckInternval = 4 * time.Second

type MmdsMetadata struct {
	InstanceID string `json:"instanceID"`
	EnvID      string `json:"envID"`
	Address    string `json:"address"`
	TraceID    string `json:"traceID"`
	TeamID     string `json:"teamID"`
}

type FC struct {
	Pid string
	Cmd *exec.Cmd
}

func newFirecrackerClient(socketPath string) *client.Firecracker {
	httpClient := client.NewHTTPClient(strfmt.NewFormats())

	transport := firecracker.NewUnixSocketTransport(socketPath, nil, false)
	httpClient.SetTransport(transport)

	return httpClient
}

func loadSnapshot(
	ctx context.Context,
	tracer trace.Tracer,
	socketPath,
	envPath string,
	metadata interface{},
) error {
	childCtx, childSpan := tracer.Start(ctx, "load-snapshot", trace.WithAttributes(
		attribute.String("instance.socket.path", socketPath),
		attribute.String("instance.snapshot.root_path", envPath),
	))
	defer childSpan.End()

	httpClient := newFirecrackerClient(socketPath)
	telemetry.ReportEvent(childCtx, "created FC socket client")

	memfilePath := filepath.Join(envPath, MemfileName)
	snapfilePath := filepath.Join(envPath, SnapfileName)

	telemetry.SetAttributes(
		childCtx,
		attribute.String("instance.memfile.path", memfilePath),
		attribute.String("instance.snapfile.path", snapfilePath),
	)

	backendType := models.MemoryBackendBackendTypeFile
	snapshotConfig := operations.LoadSnapshotParams{
		Context: childCtx,
		Body: &models.SnapshotLoadParams{
			ResumeVM:            true,
			EnableDiffSnapshots: true,
			MemBackend: &models.MemoryBackend{
				BackendPath: &memfilePath,
				BackendType: &backendType,
			},
			SnapshotPath: &snapfilePath,
		},
	}

	_, err := httpClient.Operations.LoadSnapshot(&snapshotConfig)
	if err != nil {
		telemetry.ReportCriticalError(childCtx, err)
		return err
	}
	telemetry.ReportEvent(childCtx, "snapshot loaded")

	go func() {
		mmdsConfig := operations.PutMmdsParams{
			Context: childCtx,
			Body:    metadata,
		}

		_, err = httpClient.Operations.PutMmds(&mmdsConfig)
		if err != nil {
			telemetry.ReportCriticalError(childCtx, err)
		} else {
			telemetry.ReportEvent(childCtx, "mmds data set")
		}
	}()

	return nil
}

func startFC(
	ctx context.Context,
	tracer trace.Tracer,
	allocID string,
	slot *IPSlot,
	fsEnv *InstanceFiles,
	mmdsMetadata *MmdsMetadata,
) (*FC, error) {
	childCtx, childSpan := tracer.Start(ctx, "initialize-fc", trace.WithAttributes(
		attribute.String("instance.id", slot.InstanceID),
		attribute.Int("instance.slot.index", slot.SlotIdx),
	))
	defer childSpan.End()

	vmmCtx, _ := tracer.Start(
		trace.ContextWithSpanContext(context.Background(), childSpan.SpanContext()),
		"fc-vmm",
	)

	rootfsMountCmd := fmt.Sprintf(
		"mount --bind %s %s && ",
		fsEnv.EnvInstancePath,
		fsEnv.BuildDirPath,
	)

	kernelMountCmd := fmt.Sprintf(
		"mount --bind %s %s && ",
		fsEnv.KernelDirPath,
		fsEnv.KernelMountDirPath,
	)

	fcCmd := fmt.Sprintf("%s --api-sock %s", fsEnv.FirecrackerBinaryPath, fsEnv.SocketPath)
	inNetNSCmd := fmt.Sprintf("ip netns exec %s ", slot.NamespaceID())

	cmd := exec.CommandContext(vmmCtx, "unshare", "-pfm", "--kill-child", "--", "bash", "-c", rootfsMountCmd+kernelMountCmd+inNetNSCmd+fcCmd)

	cmdStdoutReader, cmdStdoutWriter := io.Pipe()
	cmdStderrReader, cmdStderrWriter := io.Pipe()

	cmd.Stderr = cmdStdoutWriter
	cmd.Stdout = cmdStderrWriter

	go func() {
		defer func() {
			readerErr := cmdStdoutReader.Close()
			if readerErr != nil {
				errMsg := fmt.Errorf("error closing vmm stdout reader: %w", readerErr)
				telemetry.ReportError(vmmCtx, errMsg)
			}
		}()

		scanner := bufio.NewScanner(cmdStdoutReader)

		for scanner.Scan() {
			line := scanner.Text()

			telemetry.ReportEvent(vmmCtx, "vmm log",
				attribute.String("type", "stdout"),
				attribute.String("message", line),
			)
		}

		readerErr := scanner.Err()
		if readerErr != nil {
			errMsg := fmt.Errorf("error reading vmm stdout: %w", readerErr)
			telemetry.ReportError(vmmCtx, errMsg)
		} else {
			telemetry.ReportEvent(vmmCtx, "vmm stdout reader closed")
		}
	}()

	go func() {
		defer func() {
			readerErr := cmdStderrReader.Close()
			if readerErr != nil {
				errMsg := fmt.Errorf("error closing vmm stdout reader: %w", readerErr)
				telemetry.ReportError(vmmCtx, errMsg)
			}
		}()

		scanner := bufio.NewScanner(cmdStderrReader)

		for scanner.Scan() {
			line := scanner.Text()

			telemetry.ReportEvent(vmmCtx, "vmm log",
				attribute.String("type", "stderr"),
				attribute.String("message", line),
			)
		}

		readerErr := cmdStderrReader.Close()
		if readerErr != nil {
			errMsg := fmt.Errorf("error closing vmm stderr reader: %w", readerErr)
			telemetry.ReportError(vmmCtx, errMsg)
		}
	}()

	prebootFcConfig := firecracker.Config{
		DisableValidation: true,
		SocketPath:        fsEnv.SocketPath,
	}

	m, err := firecracker.NewMachine(vmmCtx, prebootFcConfig, firecracker.WithProcessRunner(cmd))
	if err != nil {
		errMsg := fmt.Errorf("failed creating machine: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "created vmm")

	m.Handlers.Validation = m.Handlers.Validation.Clear()
	m.Handlers.FcInit = m.Handlers.FcInit.Clear().
		Append(
			firecracker.StartVMMHandler,
		)

	err = m.Handlers.Run(childCtx, m)
	if err != nil {
		errMsg := fmt.Errorf("failed to start preboot FC: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "started FC in preboot")

	if err := loadSnapshot(
		childCtx,
		tracer,
		fsEnv.SocketPath,
		fsEnv.EnvPath,
		mmdsMetadata,
	); err != nil {
		m.StopVMM()
		errMsg := fmt.Errorf("failed to load snapshot: %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "loaded snapshot")

	defer func() {
		if err != nil {
			stopErr := m.StopVMM()
			if stopErr != nil {
				errMsg := fmt.Errorf("error stopping machine after error: %w", stopErr)
				telemetry.ReportError(childCtx, errMsg)
			}
		}
	}()

	pid, errpid := m.PID()
	if errpid != nil {
		errMsg := fmt.Errorf("failed getting pid for machine: %w", errpid)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}

	fc := &FC{
		Cmd: cmd,
		Pid: strconv.Itoa(pid),
	}

	telemetry.SetAttributes(
		childCtx,

		attribute.String("alloc.id", allocID),
		attribute.String("instance.pid", fc.Pid),
		attribute.String("instance.socket.path", fsEnv.SocketPath),
		attribute.String("instance.env.id", mmdsMetadata.EnvID),
		attribute.String("instance.env.path", fsEnv.EnvPath),
		attribute.String("instance.build_dir.path", fsEnv.BuildDirPath),
		attribute.String("instance.cmd", fc.Cmd.String()),
		attribute.String("instance.cmd.dir", fc.Cmd.Dir),
		attribute.String("instance.cmd.path", fc.Cmd.Path),
	)

	return fc, nil
}

func (fc *FC) Stop(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "stop-fc", trace.WithAttributes(
		attribute.String("instance.pid", fc.Pid),
		attribute.String("instance.cmd", fc.Cmd.String()),
		attribute.String("instance.cmd.dir", fc.Cmd.Dir),
		attribute.String("instance.cmd.path", fc.Cmd.Path),
	))
	defer childSpan.End()

	err := fc.Cmd.Process.Kill()
	if err != nil {
		errMsg := fmt.Errorf("failed to send KILL to FC process: %w", err)

		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "sent KILL to FC process")
	}

	return nil
}

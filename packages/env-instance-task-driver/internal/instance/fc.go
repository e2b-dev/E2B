package instance

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"strconv"

	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	"github.com/go-openapi/strfmt"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/shared/pkg/fc/client"
	"github.com/e2b-dev/infra/packages/shared/pkg/fc/client/operations"
	"github.com/e2b-dev/infra/packages/shared/pkg/fc/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

type fc struct {
	Machine  *firecracker.Machine
	Instance Instance
}

type Instance struct {
	AllocId          string
	Pid              string
	SnapshotRootPath string
	SocketPath       string
	EnvID            string
	EnvPath          string
	BuildDirPath     string
	Cmd              *exec.Cmd
}

type MmdsMetadata struct {
	InstanceID string `json:"instanceID"`
	EnvID      string `json:"envID"`
	Address    string `json:"address"`
	TraceID    string `json:"traceID"`
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
		attribute.String("socket_path", socketPath),
		attribute.String("snapshot_root_path", envPath),
	))
	defer childSpan.End()

	httpClient := newFirecrackerClient(socketPath)
	telemetry.ReportEvent(childCtx, "created FC socket client")

	memfilePath := filepath.Join(envPath, MemfileName)
	snapfilePath := filepath.Join(envPath, SnapfileName)

	telemetry.SetAttributes(
		childCtx,
		attribute.String("memfile_path", memfilePath),
		attribute.String("snapfile_path", snapfilePath),
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

func InitializeFC(
	ctx context.Context,
	tracer trace.Tracer,
	allocID string,
	slot *IPSlot,
	fsEnv *InstanceFiles,
	mmdsMetadata *MmdsMetadata,
) (*fc, error) {
	childCtx, childSpan := tracer.Start(ctx, "initialize-fc", trace.WithAttributes(
		attribute.String("instance_id", slot.InstanceID),
		attribute.Int("ip_slot_index", slot.SlotIdx),
	))
	defer childSpan.End()

	socketPath, sockErr := GetSocketPath(slot.InstanceID)
	if sockErr != nil {
		errMsg := fmt.Errorf("error getting socket path: %w", sockErr)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}

	vmmCtx, _ := tracer.Start(
		trace.ContextWithSpanContext(context.Background(), childSpan.SpanContext()),
		"fc-vmm",
	)

	mountCmd := fmt.Sprintf(
		"mount --bind  %s %s && ",
		fsEnv.EnvInstancePath,
		fsEnv.BuildDirPath,
	)

	fcCmd := fmt.Sprintf("/usr/bin/firecracker --api-sock %s", socketPath)
	inNetNSCmd := fmt.Sprintf("ip netns exec %s ", slot.NamespaceID())

	cmd := exec.CommandContext(vmmCtx, "unshare", "-pfm", "--kill-child", "--", "bash", "-c", mountCmd+inNetNSCmd+fcCmd)

	cmdStdoutReader, cmdStdoutWriter := io.Pipe()
	cmdStderrReader, cmdStderrWriter := io.Pipe()

	cmd.Stderr = cmdStdoutWriter
	cmd.Stdout = cmdStderrWriter

	go func() {
		defer func() {
			readerErr := cmdStdoutReader.Close()
			if readerErr != nil {
				errMsg := fmt.Errorf("error closing vmm stdout reader %w", readerErr)
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
			errMsg := fmt.Errorf("error reading vmm stdout %w", readerErr)
			telemetry.ReportError(vmmCtx, errMsg)
		} else {
			telemetry.ReportEvent(vmmCtx, "vmm stdout reader closed")
		}
	}()

	go func() {
		defer func() {
			readerErr := cmdStderrReader.Close()
			if readerErr != nil {
				errMsg := fmt.Errorf("error closing vmm stdout reader %w", readerErr)
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
			errMsg := fmt.Errorf("error closing vmm stderr reader %w", readerErr)
			telemetry.ReportError(vmmCtx, errMsg)
		}
	}()

	prebootFcConfig := firecracker.Config{
		DisableValidation: true,
		SocketPath:        socketPath,
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
		socketPath,
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

	info := Instance{
		Cmd:          cmd,
		AllocId:      allocID,
		Pid:          strconv.Itoa(pid),
		SocketPath:   socketPath,
		EnvID:        mmdsMetadata.EnvID,
		EnvPath:      fsEnv.EnvPath,
		BuildDirPath: fsEnv.BuildDirPath,
	}

	telemetry.SetAttributes(
		childCtx,
		attribute.String("alloc_id", info.AllocId),
		attribute.String("pid", info.Pid),
		attribute.String("socket_path", info.SocketPath),
		attribute.String("env_id", info.EnvID),
		attribute.String("env_path", info.EnvPath),
		attribute.String("build_dir_path", info.BuildDirPath),
		attribute.String("cmd", info.Cmd.String()),
		attribute.String("cmd.dir", info.Cmd.Dir),
		attribute.String("cmd.path", info.Cmd.Path),
	)

	return &fc{Machine: m, Instance: info}, nil
}

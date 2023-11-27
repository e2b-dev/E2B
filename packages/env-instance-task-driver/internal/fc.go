package internal

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	"github.com/go-openapi/strfmt"
	"github.com/hashicorp/nomad/plugins/drivers"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	envSetup "github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/env"
	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/slot"
	"github.com/e2b-dev/infra/packages/shared/pkg/fc/client"
	"github.com/e2b-dev/infra/packages/shared/pkg/fc/client/operations"
	"github.com/e2b-dev/infra/packages/shared/pkg/fc/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const (
	// containerMonitorIntv is the interval at which the driver checks if the
	// firecracker micro-vm is still running
	containerMonitorIntv = 4 * time.Second
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

func newFirecrackerClient(socketPath string) *client.Firecracker {
	httpClient := client.NewHTTPClient(strfmt.NewFormats())

	transport := firecracker.NewUnixSocketTransport(socketPath, nil, false)
	httpClient.SetTransport(transport)

	return httpClient
}

func loadSnapshot(ctx context.Context, socketPath, envPath string, d *Driver, metadata interface{}) error {
	childCtx, childSpan := d.tracer.Start(ctx, "load-snapshot", trace.WithAttributes(
		attribute.String("socket_path", socketPath),
		attribute.String("snapshot_root_path", envPath),
	))
	defer childSpan.End()

	httpClient := newFirecrackerClient(socketPath)
	telemetry.ReportEvent(childCtx, "created FC socket client")

	memfilePath := filepath.Join(envPath, envSetup.MemfileName)
	snapfilePath := filepath.Join(envPath, envSetup.SnapfileName)

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

func (d *Driver) initializeFC(
	ctx context.Context,
	cfg *drivers.TaskConfig,
	taskConfig TaskConfig,
	slot *slot.IPSlot,
	env *envSetup.InstanceFilesystem,
) (*fc, error) {
	childCtx, childSpan := d.tracer.Start(ctx, "initialize-fc", trace.WithAttributes(
		attribute.String("instance_id", slot.InstanceID),
		attribute.Int("ip_slot_index", slot.SlotIdx),
	))
	defer childSpan.End()

	socketPath, sockErr := envSetup.GetSocketPath(slot.InstanceID)
	if sockErr != nil {
		errMsg := fmt.Errorf("error getting socket path: %w", sockErr)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}

	vmmCtx, _ := d.tracer.Start(
		trace.ContextWithSpanContext(context.Background(), childSpan.SpanContext()),
		"fc-vmm",
	)

	mountCmd := fmt.Sprintf(
		"mount --bind  %s %s && ",
		env.EnvInstancePath,
		env.BuildDirPath,
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

	// TODO: We need to change this in the envd OR move the logging to the driver
	if err := loadSnapshot(
		childCtx,
		socketPath,
		env.EnvPath,
		d,
		struct {
			InstanceID string `json:"instanceID"`
			EnvID      string `json:"envID"`
			Address    string `json:"address"`
			TraceID    string `json:"traceID"`
			TeamID     string `json:"teamID"`
		}{
			InstanceID: slot.InstanceID,
			EnvID:      taskConfig.EnvID,
			TeamID:     taskConfig.TeamID,
			Address:    taskConfig.LogsProxyAddress,
			TraceID:    taskConfig.TraceID,
		},
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
		AllocId:      cfg.AllocID,
		Pid:          strconv.Itoa(pid),
		SocketPath:   socketPath,
		EnvID:        taskConfig.EnvID,
		EnvPath:      env.EnvPath,
		BuildDirPath: env.BuildDirPath,
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

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

	"github.com/devbookhq/firecracker-task-driver/internal/client/client"
	"github.com/devbookhq/firecracker-task-driver/internal/client/client/operations"
	"github.com/devbookhq/firecracker-task-driver/internal/client/models"
	"github.com/devbookhq/firecracker-task-driver/internal/env"
	"github.com/devbookhq/firecracker-task-driver/internal/slot"
	"github.com/devbookhq/firecracker-task-driver/internal/telemetry"
	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	"github.com/go-openapi/strfmt"
	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins/drivers"
	log "github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const (
	// containerMonitorIntv is the interval at which the driver checks if the
	// firecracker micro-vm is still running
	containerMonitorIntv = 4 * time.Second
)

type vminfo struct {
	Machine *firecracker.Machine
	Info    Instance_info
}
type Instance_info struct {
	AllocId              string
	Pid                  string
	SnapshotRootPath     string
	EditID               *string
	SocketPath           string
	CodeSnippetID        string
	CodeSnippetDirectory string
	BuildDirPath         string
	Cmd                  *exec.Cmd
}

func newFirecrackerClient(socketPath string) *client.Firecracker {
	httpClient := client.NewHTTPClient(strfmt.NewFormats())

	transport := firecracker.NewUnixSocketTransport(socketPath, nil, false)
	httpClient.SetTransport(transport)

	return httpClient
}

func loadSnapshot(ctx context.Context, socketPath, snapshotRootPath string, d *Driver, metadata interface{}) error {
	childCtx, childSpan := d.tracer.Start(ctx, "load-snapshot", trace.WithAttributes(
		attribute.String("socket_path", socketPath),
		attribute.String("snapshot_root_path", snapshotRootPath),
	))
	defer childSpan.End()

	httpClient := newFirecrackerClient(socketPath)
	telemetry.ReportEvent(childCtx, "created FC socket client")

	memfilePath := filepath.Join(snapshotRootPath, env.MemfileName)
	snapfilePath := filepath.Join(snapshotRootPath, env.SnapfileName)

	childSpan.SetAttributes(
		attribute.String("memfile_path", memfilePath),
		attribute.String("snapfile_path", snapfilePath),
	)

	backendType := models.MemoryBackendBackendTypeFile
	snapshotConfig := operations.LoadSnapshotParams{
		Context: childCtx,
		Body: &models.SnapshotLoadParams{
			ResumeVM:            true,
			EnableDiffSnapshots: false,
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
	env *env.Env,
) (*vminfo, error) {
	childCtx, childSpan := d.tracer.Start(ctx, "initialize-fc", trace.WithAttributes(
		attribute.String("session_id", slot.SessionID),
		attribute.Int("ip_slot_index", slot.SlotIdx),
	))
	defer childSpan.End()

	opts := newOptions()

	fcCfg, err := opts.getFirecrackerConfig(cfg.AllocID, slot.SessionID)
	if err != nil {
		errMsg := fmt.Errorf("error assembling FC config: %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}

	vmmChildCtx, vmmChildSpan := d.tracer.Start(
		childCtx,
		"fc-vmm",
		trace.WithAttributes(attribute.String("fc_log_fifo", opts.FcLogFifo)),
		trace.WithAttributes(attribute.String("fc_metrics_fifo", opts.FcMetricsFifo)),
	)
	defer vmmChildSpan.End()

	vmmCtx, vmmCancel := context.WithCancel(vmmChildCtx)
	defer vmmCancel()

	d.logger.Info("Starting firecracker", "driver_initialize_container", hclog.Fmt("%v+", opts))
	logger := log.New()
	log.SetLevel(log.DebugLevel)
	logger.SetLevel(log.DebugLevel)

	otelHook := telemetry.NewOtelHook(vmmChildSpan)
	logger.AddHook(otelHook)

	machineOpts := []firecracker.Opt{
		firecracker.WithLogger(log.NewEntry(logger)),
	}

	mountCmd := fmt.Sprintf(
		"mount --bind  %s %s && ",
		env.SessionEnvPath,
		env.BuildDirPath,
	)

	fcCmd := fmt.Sprintf("/usr/bin/firecracker --api-sock %s", fcCfg.SocketPath)
	inNetNSCmd := fmt.Sprintf("ip netns exec %s ", slot.NamespaceID())

	cmdStdoutReader, cmdStdoutWriter := io.Pipe()
	cmdStderrReader, cmdStderrWriter := io.Pipe()

	cmd := exec.CommandContext(childCtx, "unshare", "-pfm", "--kill-child", "--", "bash", "-c", mountCmd+inNetNSCmd+fcCmd)
	cmd.Stderr = cmdStdoutWriter
	cmd.Stdout = cmdStderrWriter

	machineOpts = append(
		machineOpts,
		firecracker.WithProcessRunner(cmd),
	)

	go func() {
		scanner := bufio.NewScanner(cmdStdoutReader)

		for scanner.Scan() {
			line := scanner.Text()

			telemetry.ReportEvent(vmmChildCtx, "vmm log",
				attribute.String("type", "stdout"),
				attribute.String("message", line),
			)
		}

		readerErr := cmdStdoutReader.Close()
		if readerErr != nil {
			errMsg := fmt.Errorf("error closing vmm stdout reader %v", readerErr)
			telemetry.ReportError(vmmChildCtx, errMsg)
		}
	}()

	// TODO: Make the log collecting long running
	go func() {
		scanner := bufio.NewScanner(cmdStderrReader)

		for scanner.Scan() {
			line := scanner.Text()

			telemetry.ReportEvent(vmmChildCtx, "vmm log",
				attribute.String("type", "stderr"),
				attribute.String("message", line),
			)
		}

		readerErr := cmdStderrReader.Close()
		if readerErr != nil {
			errMsg := fmt.Errorf("error closing vmm stderr reader %v", readerErr)
			telemetry.ReportError(vmmChildCtx, errMsg)
		}
	}()

	vmmLogsReader, vmmLogsWriter := io.Pipe()

	go func() {
		scanner := bufio.NewScanner(vmmLogsReader)

		for scanner.Scan() {
			line := scanner.Text()

			telemetry.ReportEvent(vmmChildCtx, "vmm log",
				attribute.String("type", "setup"),
				attribute.String("message", line),
			)
		}

		readerErr := vmmLogsReader.Close()
		if readerErr != nil {
			errMsg := fmt.Errorf("error closing vmm setup reader %v", readerErr)
			telemetry.ReportError(vmmChildCtx, errMsg)
		}
	}()

	prebootFcConfig := firecracker.Config{
		DisableValidation: true,
		MmdsAddress:       fcCfg.MmdsAddress,
		Seccomp:           fcCfg.Seccomp,
		ForwardSignals:    fcCfg.ForwardSignals,
		VMID:              fcCfg.VMID,
		MachineCfg:        fcCfg.MachineCfg,
		VsockDevices:      fcCfg.VsockDevices,
		FifoLogWriter:     vmmLogsWriter,
		Drives:            fcCfg.Drives,
		KernelArgs:        fcCfg.KernelArgs,
		InitrdPath:        fcCfg.InitrdPath,
		KernelImagePath:   fcCfg.KernelImagePath,
		MetricsFifo:       fcCfg.MetricsFifo,
		MetricsPath:       fcCfg.MetricsPath,
		LogLevel:          "Debug",
		LogFifo:           fcCfg.LogFifo,
		LogPath:           fcCfg.LogPath,
		SocketPath:        fcCfg.SocketPath,
	}

	m, err := firecracker.NewMachine(vmmCtx, prebootFcConfig, machineOpts...)
	if err != nil {
		errMsg := fmt.Errorf("failed creating machine: %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "created vmm")

	m.Handlers.Validation = m.Handlers.Validation.Clear()
	m.Handlers.FcInit =
		m.Handlers.FcInit.Clear().
			Append(
				firecracker.StartVMMHandler,
				firecracker.BootstrapLoggingHandler,
			)

	err = m.Handlers.Run(childCtx, m)
	if err != nil {
		errMsg := fmt.Errorf("failed to start preboot FC: %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "started FC in preboot")

	if err := loadSnapshot(
		childCtx,
		fcCfg.SocketPath,
		env.SnapshotRootPath,
		d,
		struct {
			SessionID     string `json:"sessionID"`
			CodeSnippetID string `json:"codeSnippetID"`
			Address       string `json:"address"`
		}{
			SessionID:     slot.SessionID,
			CodeSnippetID: taskConfig.CodeSnippetID,
			Address:       taskConfig.LogsProxyAddress,
		},
	); err != nil {
		m.StopVMM()
		errMsg := fmt.Errorf("failed to load snapshot: %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}
	telemetry.ReportEvent(childCtx, "loaded snapshot")

	defer func() {
		if err != nil {
			stopErr := m.StopVMM()
			if stopErr != nil {
				errMsg := fmt.Errorf("error stopping machine after error: %+v", stopErr)
				telemetry.ReportError(childCtx, errMsg)
				logger.Error(errMsg)
			}
		}
	}()

	pid, errpid := m.PID()
	if errpid != nil {
		errMsg := fmt.Errorf("failed getting pid for machine: %v", errpid)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return nil, errMsg
	}

	info := Instance_info{
		Cmd:                  cmd,
		AllocId:              cfg.AllocID,
		Pid:                  strconv.Itoa(pid),
		SnapshotRootPath:     env.SnapshotRootPath,
		EditID:               env.EditID,
		SocketPath:           fcCfg.SocketPath,
		CodeSnippetID:        taskConfig.CodeSnippetID,
		CodeSnippetDirectory: env.CodeSnippetEnvPath,
		BuildDirPath:         env.BuildDirPath,
	}

	childSpan.SetAttributes(
		attribute.String("alloc_id", info.AllocId),
		attribute.String("pid", info.Pid),
		attribute.String("snapshot_root_path", info.SnapshotRootPath),
		attribute.String("socket_path", info.SocketPath),
		attribute.String("code_snippet_id", info.CodeSnippetID),
		attribute.String("code_snippet_directory", info.CodeSnippetDirectory),
		attribute.String("build_dir_path", info.BuildDirPath),
		attribute.String("cmd", info.Cmd.String()),
		attribute.String("cmd.dir", info.Cmd.Dir),
		attribute.String("cmd.path", info.Cmd.Path),
	)

	if info.EditID != nil {
		childSpan.SetAttributes(
			attribute.String("edit_id", *info.EditID),
		)
	}

	return &vminfo{Machine: m, Info: info}, nil
}

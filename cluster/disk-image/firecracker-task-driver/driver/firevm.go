/* Firecracker-task-driver is a task driver for Hashicorp's nomad that allows
 * to create microvms using AWS Firecracker vmm
 * Copyright (C) 2019  Carlos Neira cneirabustos@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 */

package firevm

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"github.com/cneira/firecracker-task-driver/driver/client/client"
	"github.com/cneira/firecracker-task-driver/driver/client/client/operations"
	"github.com/cneira/firecracker-task-driver/driver/client/models"
	"github.com/cneira/firecracker-task-driver/driver/slot"
	"github.com/cneira/firecracker-task-driver/driver/telemetry"
	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	"github.com/go-openapi/strfmt"
	"github.com/google/uuid"
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

	editIDName          = "edit_id"
	buildIDName         = "build_id"
	templateIDName      = "template_id"
	templateBuildIDName = "template_build_id"
	rootfsName          = "rootfs.ext4"
	snapfileName        = "snapfile"
	memfileName         = "memfile"

	editDirName  = "edit"
	buildDirName = "builds"
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

func loadSnapshot(ctx context.Context, socketPath, snapshotRootPath string, d *Driver) error {
	childCtx, childSpan := d.tracer.Start(ctx, "load-snapshot", trace.WithAttributes(
		attribute.String("socket_path", socketPath),
		attribute.String("snapshot_root_path", snapshotRootPath),
	))
	defer childSpan.End()

	httpClient := newFirecrackerClient(socketPath)
	telemetry.ReportEvent(childCtx, "created FC socket client")

	memfilePath := filepath.Join(snapshotRootPath, memfileName)
	snapfilePath := filepath.Join(snapshotRootPath, snapfileName)

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

	return nil
}

func (d *Driver) initializeFC(
	ctx context.Context,
	cfg *drivers.TaskConfig,
	taskConfig TaskConfig,
	slot *slot.IPSlot,
	fcEnvsDisk string,
	editEnabled bool,
) (*vminfo, error) {
	childCtx, childSpan := d.tracer.Start(ctx, "initialize-fc", trace.WithAttributes(
		attribute.String("session_id", slot.SessionID),
		attribute.Int("ip_slot_index", slot.SlotIdx),
	))
	defer childSpan.End()

	opts := newOptions()

	fcCfg, err := opts.getFirecrackerConfig(cfg.AllocID)
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

	err = os.MkdirAll(slot.SessionTmpOverlay(), 0777)
	if err != nil {
		telemetry.ReportError(childCtx, err)
	}
	err = os.MkdirAll(slot.SessionTmpWorkdir(), 0777)
	if err != nil {
		telemetry.ReportError(childCtx, err)
	}

	codeSnippetEnvPath := filepath.Join(fcEnvsDisk, taskConfig.CodeSnippetID)

	var buildDirPath string
	var snapshotRootPath string
	var mountCmd string
	var editID string

	if editEnabled {
		// Use the shared edit sessions
		codeSnippetEditPath := filepath.Join(codeSnippetEnvPath, editDirName)

		buildIDSrc := filepath.Join(codeSnippetEnvPath, buildIDName)
		buildIDDest := filepath.Join(codeSnippetEditPath, buildIDName)

		templateIDSrc := filepath.Join(codeSnippetEnvPath, templateIDName)
		templateIDDest := filepath.Join(codeSnippetEditPath, templateIDName)

		templateBuildIDSrc := filepath.Join(codeSnippetEnvPath, templateBuildIDName)
		templateBuildIDDest := filepath.Join(codeSnippetEditPath, templateBuildIDName)

		editIDPath := filepath.Join(codeSnippetEditPath, editIDName)

		err = os.MkdirAll(codeSnippetEditPath, 0777)
		if err != nil {
			telemetry.ReportError(childCtx, err)
		}

		if _, err := os.Stat(editIDPath); err == nil {
			// If the edit_file exists we expect that the other files will exists too (we are creating te edit last)
			data, err := os.ReadFile(editIDPath)
			if err != nil {
				return nil, fmt.Errorf("failed reading edit id for the code snippet %s: %v", taskConfig.CodeSnippetID, err)
			}
			editID = string(data)

			snapshotRootPath = filepath.Join(codeSnippetEditPath, editID)
		} else {
			// Link the fc files from the root CS directory and create edit_id
			editID = uuid.New().String()

			snapshotRootPath = filepath.Join(codeSnippetEditPath, editID)
			err = os.MkdirAll(snapshotRootPath, 0777)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			rootfsSrc := filepath.Join(codeSnippetEnvPath, rootfsName)
			rootfsDest := filepath.Join(codeSnippetEditPath, editID, rootfsName)

			snapfileSrc := filepath.Join(codeSnippetEnvPath, snapfileName)
			snapfileDest := filepath.Join(codeSnippetEditPath, editID, snapfileName)

			memfileSrc := filepath.Join(codeSnippetEnvPath, memfileName)
			memfileDest := filepath.Join(codeSnippetEditPath, editID, memfileName)

			err = os.Link(rootfsSrc, rootfsDest)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			err = os.Link(snapfileSrc, snapfileDest)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			err = os.Link(memfileSrc, memfileDest)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			err = os.Link(buildIDSrc, buildIDDest)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			err = os.Link(templateIDSrc, templateIDDest)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			err = os.Link(templateBuildIDSrc, templateBuildIDDest)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			err := os.WriteFile(editIDPath, []byte(editID), 0777)
			if err != nil {
				errMsg := fmt.Errorf("unable to create edit_id file: %v", err)
				telemetry.ReportError(childCtx, errMsg)
			}
		}

		if _, err := os.Stat(buildIDDest); err != nil {
			// If the build_id file does not exist this envs is templated - we check to which env the template points to and use that as our new "virtual" env
			data, err := os.ReadFile(templateIDDest)
			if err != nil {
				return nil, fmt.Errorf("failed reading template id for the code snippet %s: %v", taskConfig.CodeSnippetID, err)
			}
			templateID := string(data)

			templateEnvPath := filepath.Join(fcEnvsDisk, templateID)

			data, err = os.ReadFile(templateBuildIDDest)
			if err != nil {
				return nil, fmt.Errorf("failed reading build id for the template %s of code snippet %s: %v", templateID, taskConfig.CodeSnippetID, err)
			}
			templateBuildID := string(data)
			buildDirPath = filepath.Join(templateEnvPath, buildDirName, templateBuildID)
		} else {
			// build_id is present so this is a non-templated session
			data, err := os.ReadFile(buildIDDest)
			if err != nil {
				return nil, fmt.Errorf("failed reading build id for the code snippet %s: %v", taskConfig.CodeSnippetID, err)
			}
			buildID := string(data)
			buildDirPath = filepath.Join(codeSnippetEnvPath, buildDirName, buildID)
		}

		err = os.MkdirAll(buildDirPath, 0777)
		if err != nil {
			telemetry.ReportError(childCtx, err)
		}

		mountCmd = fmt.Sprintf(
			"mount -t overlay overlay -o lowerdir=%s,upperdir=%s,workdir=%s %s && ",
			snapshotRootPath,
			slot.SessionTmpOverlay(),
			slot.SessionTmpWorkdir(),
			buildDirPath,
		)
	} else {
		// Mount overlay
		snapshotRootPath = codeSnippetEnvPath

		templateIDPath := filepath.Join(codeSnippetEnvPath, templateIDName)
		templateBuildIDPath := filepath.Join(codeSnippetEnvPath, templateBuildIDName)
		buildIDPath := filepath.Join(codeSnippetEnvPath, buildIDName)

		if _, err := os.Stat(buildIDPath); err != nil {
			// If the build_id file does not exist this envs is templated - we check to which env the template points to and use that as our new "virtual" env
			data, err := os.ReadFile(templateIDPath)
			if err != nil {
				return nil, fmt.Errorf("failed reading template id for the code snippet %s: %v", taskConfig.CodeSnippetID, err)
			}
			templateID := string(data)

			templateEnvPath := filepath.Join(fcEnvsDisk, templateID)

			data, err = os.ReadFile(templateBuildIDPath)
			if err != nil {
				return nil, fmt.Errorf("failed reading build id for the template %s of code snippet %s: %v", templateID, taskConfig.CodeSnippetID, err)
			}
			templateBuildID := string(data)
			buildDirPath = filepath.Join(templateEnvPath, buildDirName, templateBuildID)
		} else {
			// build_id is present and this is a normal non-templated and non-edit session
			data, err := os.ReadFile(buildIDPath)
			if err != nil {
				return nil, fmt.Errorf("failed reading build id for the code snippet %s: %v", taskConfig.CodeSnippetID, err)
			}
			buildID := string(data)
			buildDirPath = filepath.Join(codeSnippetEnvPath, buildDirName, buildID)
		}

		err = os.MkdirAll(buildDirPath, 0777)
		if err != nil {
			telemetry.ReportError(childCtx, err)
		}

		mountCmd = fmt.Sprintf(
			"mount -t overlay overlay -o lowerdir=%s,upperdir=%s,workdir=%s %s && ",
			snapshotRootPath,
			slot.SessionTmpOverlay(),
			slot.SessionTmpWorkdir(),
			buildDirPath,
		)
	}

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

	// TODO: Make the log collecting long running
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

	// TODO: Make the log collecting long running
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

	if err := loadSnapshot(childCtx, fcCfg.SocketPath, snapshotRootPath, d); err != nil {
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

	if opts.validMetadata != nil {
		m.SetMetadata(vmmCtx, opts.validMetadata)
	}

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
		SnapshotRootPath:     snapshotRootPath,
		EditID:               &editID,
		SocketPath:           fcCfg.SocketPath,
		CodeSnippetID:        taskConfig.CodeSnippetID,
		CodeSnippetDirectory: codeSnippetEnvPath,
		BuildDirPath:         buildDirPath,
	}

	return &vminfo{Machine: m, Info: info}, nil
}

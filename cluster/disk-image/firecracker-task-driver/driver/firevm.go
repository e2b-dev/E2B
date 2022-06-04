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
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"github.com/cneira/firecracker-task-driver/driver/client/client"
	"github.com/cneira/firecracker-task-driver/driver/client/client/operations"
	"github.com/cneira/firecracker-task-driver/driver/client/models"
	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	"github.com/go-openapi/strfmt"
	"github.com/google/uuid"
	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins/drivers"
	log "github.com/sirupsen/logrus"
)

const (
	// containerMonitorIntv is the interval at which the driver checks if the
	// firecracker micro-vm is still running
	containerMonitorIntv = 2 * time.Second

	editIDName   = "edit_id"
	buildIDName  = "build_id"
	rootfsName   = "rootfs.ext4"
	snapfileName = "snapfile"
	memfileName  = "memfile"

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
}

func newFirecrackerClient(socketPath string) *client.Firecracker {
	httpClient := client.NewHTTPClient(strfmt.NewFormats())

	transport := firecracker.NewUnixSocketTransport(socketPath, nil, false)
	httpClient.SetTransport(transport)

	return httpClient
}

func loadSnapshot(ctx context.Context, socketPath, snapshotRootPath string) (*operations.LoadSnapshotNoContent, error) {
	httpClient := newFirecrackerClient(socketPath)

	memfilePath := filepath.Join(snapshotRootPath, memfileName)
	snapfilePath := filepath.Join(snapshotRootPath, snapfileName)

	backendType := models.MemoryBackendBackendTypeFile
	snapshotConfig := operations.LoadSnapshotParams{
		Context: ctx,
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

	return httpClient.Operations.LoadSnapshot(&snapshotConfig)
}

func (d *Driver) initializeContainer(
	ctx context.Context,
	cfg *drivers.TaskConfig,
	taskConfig TaskConfig,
	slot *IPSlot,
	fcEnvsDisk string,
	editEnabled bool,
) (*vminfo, error) {
	opts := newOptions()
	fcCfg, err := opts.getFirecrackerConfig(cfg.AllocID)
	if err != nil {
		log.Errorf("Error: %s", err)
		return nil, err
	}

	d.logger.Info("Starting firecracker", "driver_initialize_container", hclog.Fmt("%v+", opts))
	logger := log.New()

	if opts.Debug {
		log.SetLevel(log.DebugLevel)
		logger.SetLevel(log.DebugLevel)
	}

	vmmCtx, vmmCancel := context.WithCancel(ctx)
	defer vmmCancel()

	machineOpts := []firecracker.Opt{
		firecracker.WithLogger(log.NewEntry(logger)),
	}

	os.MkdirAll(slot.SessionTmpOverlay(), 0777)
	os.MkdirAll(slot.SessionTmpWorkdir(), 0777)

	codeSnippetEnvPath := filepath.Join(fcEnvsDisk, taskConfig.CodeSnippetID)

	var buildDirPath string
	var snapshotRootPath string
	var mountCmd string
	var editID string

	if editEnabled {
		codeSnippetEditPath := filepath.Join(codeSnippetEnvPath, editDirName)

		buildIDSrc := filepath.Join(codeSnippetEnvPath, buildIDName)
		buildIDDest := filepath.Join(codeSnippetEditPath, buildIDName)

		editIDPath := filepath.Join(codeSnippetEditPath, editIDName)

		os.MkdirAll(codeSnippetEditPath, 0777)

		if _, err := os.Stat(editIDPath); err == nil {
			data, err := os.ReadFile(editIDPath)
			if err != nil {
				return nil, fmt.Errorf("failed reading edit id for the code snippet %s: %v", taskConfig.CodeSnippetID, err)
			}
			editID = string(data)

			snapshotRootPath = filepath.Join(codeSnippetEditPath, editID)
		} else {
			editID = uuid.New().String()

			snapshotRootPath = filepath.Join(codeSnippetEditPath, editID)
			os.MkdirAll(snapshotRootPath, 0777)

			rootfsSrc := filepath.Join(codeSnippetEnvPath, rootfsName)
			rootfsDest := filepath.Join(codeSnippetEditPath, editID, rootfsName)

			snapfileSrc := filepath.Join(codeSnippetEnvPath, snapfileName)
			snapfileDest := filepath.Join(codeSnippetEditPath, editID, snapfileName)

			memfileSrc := filepath.Join(codeSnippetEnvPath, memfileName)
			memfileDest := filepath.Join(codeSnippetEditPath, editID, memfileName)

			os.Link(rootfsSrc, rootfsDest)
			os.Link(snapfileSrc, snapfileDest)
			os.Link(memfileSrc, memfileDest)
			os.Link(buildIDSrc, buildIDDest)

			err := os.WriteFile(editIDPath, []byte(editID), 0777)
			if err != nil {
				fmt.Printf("Unable to create edit_id file: %v", err)
			}
		}

		data, err := os.ReadFile(buildIDDest)
		if err != nil {
			return nil, fmt.Errorf("failed reading build id for the code snippet %s: %v", taskConfig.CodeSnippetID, err)
		}
		buildID := string(data)

		buildDirPath = filepath.Join(codeSnippetEnvPath, buildDirName, buildID)
		os.MkdirAll(buildDirPath, 0777)

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

		buildIDPath := filepath.Join(codeSnippetEnvPath, buildIDName)

		data, err := os.ReadFile(buildIDPath)
		if err != nil {
			return nil, fmt.Errorf("failed reading build id for the code snippet %s: %v", taskConfig.CodeSnippetID, err)
		}
		buildID := string(data)

		buildDirPath = filepath.Join(codeSnippetEnvPath, buildDirName, buildID)
		os.MkdirAll(buildDirPath, 0777)

		mountCmd = fmt.Sprintf(
			"mount -t overlay overlay -o lowerdir=%s,upperdir=%s,workdir=%s %s && ",
			snapshotRootPath,
			slot.SessionTmpOverlay(),
			slot.SessionTmpWorkdir(),
			buildDirPath,
		)
	}

	fcCmd := fmt.Sprintf("/usr/bin/firecracker --api-sock %s ", fcCfg.SocketPath)
	inNetNSCmd := fmt.Sprintf("ip netns exec %s ", slot.NamespaceID())

	cmd := exec.CommandContext(ctx, "unshare", "-pfm", "--kill-child", "--", "bash", "-c", mountCmd+inNetNSCmd+fcCmd)
	cmd.Stderr = nil

	machineOpts = append(machineOpts, firecracker.WithProcessRunner(cmd))

	prebootFcConfig := firecracker.Config{
		DisableValidation: true,
		MmdsAddress:       fcCfg.MmdsAddress,
		Seccomp:           fcCfg.Seccomp,
		ForwardSignals:    fcCfg.ForwardSignals,
		VMID:              fcCfg.VMID,
		MachineCfg:        fcCfg.MachineCfg,
		VsockDevices:      fcCfg.VsockDevices,
		FifoLogWriter:     fcCfg.FifoLogWriter,
		Drives:            fcCfg.Drives,
		KernelArgs:        fcCfg.KernelArgs,
		InitrdPath:        fcCfg.InitrdPath,
		KernelImagePath:   fcCfg.KernelImagePath,
		MetricsFifo:       fcCfg.MetricsFifo,
		MetricsPath:       fcCfg.MetricsPath,
		LogLevel:          fcCfg.LogLevel,
		LogFifo:           fcCfg.LogFifo,
		LogPath:           fcCfg.LogPath,
		SocketPath:        fcCfg.SocketPath,
	}

	m, err := firecracker.NewMachine(vmmCtx, prebootFcConfig, machineOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed creating machine: %v", err)
	}
	m.Handlers.Validation = m.Handlers.Validation.Clear()
	m.Handlers.FcInit =
		m.Handlers.FcInit.Clear().
			Append(
				firecracker.StartVMMHandler,
			)

	err = m.Handlers.Run(ctx, m)
	if err != nil {
		return nil, fmt.Errorf("failed to start preboot FC: %v", err)
	}

	if _, err := loadSnapshot(vmmCtx, fcCfg.SocketPath, snapshotRootPath); err != nil {
		m.StopVMM()
		return nil, fmt.Errorf("failed to load snapshot: %v", err)
	}

	defer func() {
		if err != nil {
			stopErr := m.StopVMM()
			if stopErr != nil {
				logger.Error(fmt.Sprintf("Failed stopping machine after error: %+v", stopErr))
			}
		}
	}()

	if opts.validMetadata != nil {
		m.SetMetadata(vmmCtx, opts.validMetadata)
	}

	pid, errpid := m.PID()
	if errpid != nil {
		return nil, fmt.Errorf("failed getting pid for machine: %v", errpid)
	}

	info := Instance_info{
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

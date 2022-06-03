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

	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	client "github.com/firecracker-microvm/firecracker-go-sdk/client"
	"github.com/firecracker-microvm/firecracker-go-sdk/client/models"
	"github.com/firecracker-microvm/firecracker-go-sdk/client/operations"
	"github.com/go-openapi/strfmt"
	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins/drivers"
	log "github.com/sirupsen/logrus"
)

const (
	// containerMonitorIntv is the interval at which the driver checks if the
	// firecracker micro-vm is still running
	containerMonitorIntv = 2 * time.Second
	defaultbootoptions   = " console=ttyS0 reboot=k panic=1 pci=off nomodules"
)

type vminfo struct {
	Machine *firecracker.Machine
	Info    Instance_info
}
type Instance_info struct {
	AllocId string
	Pid     string
}

func newFirecrackerClient(socketPath string) *client.Firecracker {
	httpClient := client.NewHTTPClient(strfmt.NewFormats())

	transport := firecracker.NewUnixSocketTransport(socketPath, nil, false)
	httpClient.SetTransport(transport)

	return httpClient
}

func loadSnapshot(ctx context.Context, cfg *firecracker.Config, codeSnippetID string, fcEnvsDisk string) (*operations.LoadSnapshotNoContent, error) {
	httpClient := newFirecrackerClient(cfg.SocketPath)

	memFilePath := filepath.Join(fcEnvsDisk, codeSnippetID, "memfile")
	snapshotFilePath := filepath.Join(fcEnvsDisk, codeSnippetID, "snapfile")

	// TODO: Use new API (mem_backend)
	snapshotConfig := operations.LoadSnapshotParams{
		Context: ctx,
		Body: &models.SnapshotLoadParams{
			ResumeVM:            true,
			EnableDiffSnapshots: false,
			MemFilePath:         &memFilePath,
			SnapshotPath:        &snapshotFilePath,
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
	saveFSChanges bool,
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

	buildIDPath := filepath.Join(fcEnvsDisk, taskConfig.CodeSnippetID, "build_id")
	data, err := os.ReadFile(buildIDPath)
	if err != nil {
		return nil, fmt.Errorf("failed reading build id for the code snippet %s: %v", taskConfig.CodeSnippetID, err)
	}
	buildID := string(data)

	os.MkdirAll(slot.SessionTmpOverlay(), 0777)
	os.MkdirAll(slot.SessionTmpWorkdir(), 0777)

	codeSnippetEnvPath := filepath.Join(fcEnvsDisk, taskConfig.CodeSnippetID)

	buildDirPath := filepath.Join(codeSnippetEnvPath, "builds", buildID)
	os.MkdirAll(buildDirPath, 0777)

	fcCmd := fmt.Sprintf("/usr/bin/firecracker --api-sock %s ", fcCfg.SocketPath)
	inNetNSCmd := fmt.Sprintf("ip netns exec %s ", slot.NamespaceID())

	var mountCmd string

	if saveFSChanges {
		// Mount the actual rootfs
		mountCmd = fmt.Sprintf(
			"mount -o bind %s %s && ",
			codeSnippetEnvPath,
			buildDirPath,
		)
	} else {
		// Mount overlay
		mountCmd = fmt.Sprintf(
			"mount -t overlay overlay -o lowerdir=%s,upperdir=%s,workdir=%s %s && ",
			codeSnippetEnvPath,
			slot.SessionTmpOverlay(),
			slot.SessionTmpWorkdir(),
			buildDirPath,
		)
	}

	cmd := exec.CommandContext(ctx, "unshare", "-pfm", "--kill-child", "--", "bash", "-c", mountCmd+inNetNSCmd+fcCmd)
	cmd.Stderr = nil

	machineOpts = append(machineOpts, firecracker.WithProcessRunner(cmd))

	prebootFcConfig := firecracker.Config{
		DisableValidation: true,
		MmdsAddress:       fcCfg.MmdsAddress,
		Seccomp:           fcCfg.Seccomp,
		ForwardSignals:    fcCfg.ForwardSignals,
		// NetNS:             slot.NetNSPath(),
		VMID: fcCfg.VMID,
		// JailerCfg:         &firecracker.JailerConfig{},
		MachineCfg:    fcCfg.MachineCfg,
		VsockDevices:  fcCfg.VsockDevices,
		FifoLogWriter: fcCfg.FifoLogWriter,
		// NetworkInterfaces: []firecracker.NetworkInterface{{
		// 	CNIConfiguration: &firecracker.CNIConfiguration{
		// 		NetworkName: "default",
		// 		IfName:      "eth0",
		// 	},
		// }},
		Drives:          fcCfg.Drives,
		KernelArgs:      fcCfg.KernelArgs,
		InitrdPath:      fcCfg.InitrdPath,
		KernelImagePath: fcCfg.KernelImagePath,
		MetricsFifo:     fcCfg.MetricsFifo,
		MetricsPath:     fcCfg.MetricsPath,
		LogLevel:        fcCfg.LogLevel,
		LogFifo:         fcCfg.LogFifo,
		LogPath:         fcCfg.LogPath,
		SocketPath:      fcCfg.SocketPath,
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

	if _, err := loadSnapshot(vmmCtx, &fcCfg, taskConfig.CodeSnippetID, fcEnvsDisk); err != nil {
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
		AllocId: cfg.AllocID,
		Pid:     strconv.Itoa(pid),
	}

	return &vminfo{Machine: m, Info: info}, nil
}

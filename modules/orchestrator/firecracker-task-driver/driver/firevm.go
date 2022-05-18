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
	 "os/exec"
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
	 // executableMask is the mask needed to check whether or not a file's
	 // permissions are executable.
	 executableMask = 0111
 
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
 
 func loadSnapshot(ctx context.Context, cfg *firecracker.Config, snapshotPath string, memFilePath string) (*operations.LoadSnapshotNoContent, error) {
	 httpClient := newFirecrackerClient(cfg.SocketPath)
 
	 // TODO: Use new API (mem_backend)
	 snapshotConfig := operations.LoadSnapshotParams{
		 Context: ctx,
		 Body: &models.SnapshotLoadParams{
			 ResumeVM:            true,
			 EnableDiffSnapshots: false,
			 MemFilePath:         &memFilePath,
			 SnapshotPath:        &snapshotPath,
		 },
	 }
 
	 return httpClient.Operations.LoadSnapshot(&snapshotConfig)
 }
 
 func (d *Driver) initializeContainer(ctx context.Context, cfg *drivers.TaskConfig, taskConfig TaskConfig, slot *IPSlot) (*vminfo, error) {
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
 
	 cmd := exec.CommandContext(ctx, "ip", "netns", "exec", slot.NamespaceID(), "firecracker", "--api-sock", fcCfg.SocketPath)
	 cmd.Stderr = nil
 
	 machineOpts = append(machineOpts, firecracker.WithProcessRunner(cmd))
 
	 prebootFcConfig := firecracker.Config{
		 DisableValidation: true,
		 MmdsAddress:       fcCfg.MmdsAddress,
		 Seccomp:           fcCfg.Seccomp,
		 ForwardSignals:    fcCfg.ForwardSignals,
		 NetNS:             "/var/run/netns/" + slot.NamespaceID(),
		 VMID:              fcCfg.VMID,
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
		 return nil, fmt.Errorf("Failed creating machine: %v", err)
	 }
	 m.Handlers.Validation = m.Handlers.Validation.Clear()
	 m.Handlers.FcInit =
		 m.Handlers.FcInit.Clear().
			 Append(
				 firecracker.StartVMMHandler,
			 )
 
	 err = m.Handlers.Run(ctx, m)
	 if err != nil {
		 return nil, fmt.Errorf("Failed to start preboot FC: %v", err)
	 }
 
	 if _, err := loadSnapshot(vmmCtx, &fcCfg, taskConfig.Snapshot, taskConfig.MemFile); err != nil {
		 m.StopVMM()
		 return nil, fmt.Errorf("Failed to load snapshot: %v", err)
	 }
 
	 if opts.validMetadata != nil {
		 m.SetMetadata(vmmCtx, opts.validMetadata)
	 }
 
	 pid, errpid := m.PID()
	 if errpid != nil {
		 return nil, fmt.Errorf("Failed getting pid for machine: %v", errpid)
	 }
 
	 info := Instance_info{
		 AllocId: cfg.AllocID,
		 Pid:     strconv.Itoa(pid),
	 }
 
	 return &vminfo{Machine: m, Info: info}, nil
 }
 
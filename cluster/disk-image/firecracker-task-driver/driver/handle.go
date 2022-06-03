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
	"path/filepath"
	"strconv"

	// "sync"
	"syscall"
	"time"

	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/client/stats"
	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/shirou/gopsutil/process"
)

var (
	firecrackerCPUStats = []string{"System Mode", "User Mode", "Percent"}
	firecrackerMemStats = []string{"RSS", "Swap"}
)

type taskHandle struct {
	logger hclog.Logger
	// TODO: The mutext here causes deadlock when we are stopping tasks
	// For now we are not using it - the relevant data will be still valid (FC running/exit).
	// stateLock syncs access to all fields below
	// stateLock sync.RWMutex

	taskConfig      *drivers.TaskConfig
	State           drivers.TaskState
	MachineInstance *firecracker.Machine
	Slot            *IPSlot
	Info            Instance_info
	EditEnabled     bool
	startedAt       time.Time
	completedAt     time.Time
	exitResult      *drivers.ExitResult

	cpuStatsSys   *stats.CpuStats
	cpuStatsUser  *stats.CpuStats
	cpuStatsTotal *stats.CpuStats
}

func (h *taskHandle) TaskStatus() *drivers.TaskStatus {
	// h.stateLock.RLock()
	// defer h.stateLock.RUnlock()

	return &drivers.TaskStatus{
		ID:          h.taskConfig.ID,
		Name:        h.taskConfig.Name,
		State:       h.State,
		StartedAt:   h.startedAt,
		CompletedAt: h.completedAt,
		ExitResult:  h.exitResult,
		DriverAttributes: map[string]string{
			"Pid": h.Info.Pid,
		},
	}
}

func (h *taskHandle) run() {
	// h.stateLock.Lock()
	// if h.exitResult == nil {
	// 	h.exitResult = &drivers.ExitResult{}
	// }
	// /* TODO:
	//  *  To really check the status by querying the firecracker's API, you need to call DescribeInstance
	//  *  which is not implemented in firecracker-go-sdk
	//  *  https://github.com/firecracker-microvm/firecracker-go-sdk/issues/115
	//  */
	// h.stateLock.Unlock()

	pid, err := strconv.Atoi(h.Info.Pid)
	if err != nil {
		h.Slot.RemoveNamespace(h.logger)
		h.logger.Info(fmt.Sprintf("ERROR Firecracker-task-driver Could not parse pid=%s after initialization", h.Info.Pid))
		// h.stateLock.Lock()
		h.exitResult = &drivers.ExitResult{}
		h.exitResult.ExitCode = 127
		h.exitResult.Signal = 0
		h.completedAt = time.Now()
		h.State = drivers.TaskStateExited
		// h.stateLock.Unlock()
		return
	}

	for {
		time.Sleep(containerMonitorIntv)

		process, err := os.FindProcess(int(pid))
		if err != nil {
			break
		}

		if process.Signal(syscall.Signal(0)) != nil {
			break
		}
	}

	// h.stateLock.Lock()
	// defer h.stateLock.Unlock()

	h.Slot.RemoveNamespace(h.logger)
	h.exitResult = &drivers.ExitResult{}
	h.exitResult.ExitCode = 0
	h.exitResult.Signal = 0
	h.completedAt = time.Now()
	h.State = drivers.TaskStateExited
}

func (h *taskHandle) stats(ctx context.Context, statsChannel chan *drivers.TaskResourceUsage, interval time.Duration) {
	defer close(statsChannel)
	timer := time.NewTimer(0)
	h.logger.Debug("Starting stats collection for ", h.taskConfig.ID)
	for {
		select {
		case <-ctx.Done():
			h.logger.Debug("Stopping stats collection for ", h.taskConfig.ID)
			return
		case <-timer.C:
			timer.Reset(interval)
		}

		// h.stateLock.Lock()
		t := time.Now()

		pid, err := strconv.Atoi(h.Info.Pid)
		if err != nil {
			h.logger.Error("unable to convert pid ", h.Info.Pid, " to int from ", h.taskConfig.ID)
			continue
		}

		p, err := process.NewProcess(int32(pid))
		if err != nil {
			h.logger.Error("unable create new process ", h.Info.Pid, " from ", h.taskConfig.ID)
			continue
		}
		ms := &drivers.MemoryStats{}
		if memInfo, err := p.MemoryInfo(); err == nil {
			ms.RSS = memInfo.RSS
			ms.Swap = memInfo.Swap
			ms.Measured = firecrackerMemStats
		}

		cs := &drivers.CpuStats{}
		if cpuStats, err := p.Times(); err == nil {
			cs.SystemMode = h.cpuStatsSys.Percent(cpuStats.System * float64(time.Second))
			cs.UserMode = h.cpuStatsUser.Percent(cpuStats.User * float64(time.Second))
			cs.Measured = firecrackerCPUStats

			// calculate cpu usage percent
			cs.Percent = h.cpuStatsTotal.Percent(cpuStats.Total() * float64(time.Second))
		}
		// h.stateLock.Unlock()

		// update uasge
		usage := drivers.TaskResourceUsage{
			ResourceUsage: &drivers.ResourceUsage{
				CpuStats:    cs,
				MemoryStats: ms,
			},
			Timestamp: t.UTC().UnixNano(),
		}
		// send stats to nomad
		statsChannel <- &usage
	}
}

func (h *taskHandle) shutdown() error {
	var err error
	if h.EditEnabled {
		err = saveEditSnapshot(h.Slot, &h.Info)
		h.logger.Error("error persisting edit session %v", err)

	}

	h.MachineInstance.StopVMM()

	pid, err := strconv.Atoi(h.Info.Pid)
	if err == nil {
		timeout := time.After(20 * time.Second)

	pidCheck:
		for {
			select {
			case <-timeout:
				break pidCheck
			default:
				process, err := os.FindProcess(int(pid))
				if err != nil {
					break pidCheck
				}

				if process.Signal(syscall.Signal(0)) != nil {
					break pidCheck
				}
			}
			time.Sleep(containerMonitorIntv)
		}
	}

	if h.EditEnabled {
		oldEditDirPath := filepath.Join(h.Info.CodeSnippetDirectory, "edit", *h.Info.EditID)
		os.RemoveAll(oldEditDirPath)
	}

	h.Slot.RemoveNamespace(h.logger)

	return nil
}

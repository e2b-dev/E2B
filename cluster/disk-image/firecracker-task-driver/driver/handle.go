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
	"sync"

	// "sync"
	"syscall"
	"time"

	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	hclog "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/client/stats"
	"github.com/hashicorp/nomad/plugins/drivers"
)

var (
	firecrackerCPUStats = []string{"System Mode", "User Mode", "Percent"}
	firecrackerMemStats = []string{"RSS", "Swap"}
)

type taskHandle struct {
	ctx    context.Context
	logger hclog.Logger
	// TODO: The mutext here causes deadlock when we are stopping tasks
	// For now we are not using it - the relevant data will be still valid (FC running/exit).
	// stateLock syncs access to all fields below
	stateLock sync.RWMutex

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
	h.stateLock.RLock()
	defer h.stateLock.RUnlock()

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

func (h *taskHandle) run(ctx context.Context, driver *Driver) {
	pid, err := strconv.Atoi(h.Info.Pid)
	if err != nil {
		h.logger.Info(fmt.Sprintf("ERROR Firecracker-task-driver Could not parse pid=%s after initialization", h.Info.Pid))
		h.stateLock.Lock()
		h.exitResult = &drivers.ExitResult{}
		h.exitResult.ExitCode = 127
		h.exitResult.Signal = 0
		h.completedAt = time.Now()
		h.State = drivers.TaskStateExited
		h.stateLock.Unlock()
		return
	}

	// maxSessionLength := time.NewTimer(24 * time.Hour)

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
	}
}

func (h *taskHandle) shutdown(ctx context.Context, driver *Driver) error {
	childCtx, childSpan := driver.tracer.Start(ctx, "shutdown")
	defer childSpan.End()

	// var err error
	if h.EditEnabled {
		// if the build id and template id doesn't exist the code snippet was deleted
		buildIDPath := filepath.Join(h.Info.CodeSnippetDirectory, buildIDName)
		if _, err := os.Stat(buildIDPath); err != nil {
			// build id doesn't exist - the code snippet may be using template
			templateIDPath := filepath.Join(h.Info.CodeSnippetDirectory, templateIDName)
			if _, err := os.Stat(templateIDPath); err != nil {
				// template id doesn't exist
			} else {
				saveEditErr := saveEditSnapshot(h.Slot, &h.Info)
				if saveEditErr != nil {
					driver.ReportError(childCtx, fmt.Errorf("error persisting edit session %v", err))
				}
			}
		} else {
			saveEditErr := saveEditSnapshot(h.Slot, &h.Info)
			if saveEditErr != nil {
				driver.ReportError(childCtx, fmt.Errorf("error persisting edit session %v", err))
			}
		}
	}

	h.Info.Cmd.Process.Signal(syscall.SIGTERM)
	driver.ReportEvent(childCtx, "sent SIGTERM to FC process")

	pid, pErr := strconv.Atoi(h.Info.Pid)
	if pErr == nil {
		timeout := time.After(10 * time.Second)

	pidCheck:
		for {
			select {
			case <-timeout:
				h.Info.Cmd.Process.Kill()
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

	h.Info.Cmd.Process.Wait()

	if h.EditEnabled {
		oldEditDirPath := filepath.Join(h.Info.CodeSnippetDirectory, editDirName, *h.Info.EditID)
		os.RemoveAll(oldEditDirPath)
	}

	driver.ReportEvent(childCtx, "waiting for state lock")
	h.stateLock.Lock()
	defer h.stateLock.Unlock()
	driver.ReportEvent(childCtx, "passed state lock")

	h.exitResult = &drivers.ExitResult{}
	h.exitResult.ExitCode = 0
	h.exitResult.Signal = 0
	h.completedAt = time.Now()
	h.State = drivers.TaskStateExited
	driver.ReportEvent(childCtx, "updated task exit info")

	return nil
}

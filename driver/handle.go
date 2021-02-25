/* Firecracker-task-driver is a task driver for Hashicorp's nomad that allows
 * to create microvms using AWS Firecracker vmm
 * Copyright (C) 2019  Carlos Neira cneirabustos@gmail.com
 *
 * This file is part of Firecracker-task-driver.
 *
 * Foobar is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * Firecracker-task-driver is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Firecracker-task-driver. If not, see <http://www.gnu.org/licenses/>.
 */

package firevm

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
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

	// stateLock syncs access to all fields below
	stateLock sync.RWMutex

	taskConfig      *drivers.TaskConfig
	State           drivers.TaskState
	MachineInstance *firecracker.Machine
	Info            Instance_info
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
			"Ip":     h.Info.Ip,
			"Serial": h.Info.Serial,
			"Pid":    h.Info.Pid,
		},
	}
}

func (h *taskHandle) IsRunning() bool {
	h.stateLock.RLock()
	defer h.stateLock.RUnlock()
	return h.State == drivers.TaskStateRunning
}

func (h *taskHandle) run() {
	h.stateLock.Lock()
	if h.exitResult == nil {
		h.exitResult = &drivers.ExitResult{}
	}
	/* TODO:
	 *  To really check the status by querying the firecracker's API, you need to call DescribeInstance
	 *  which is not implemented in firecracker-go-sdk
	 *  https://github.com/firecracker-microvm/firecracker-go-sdk/issues/115
	 */
	h.stateLock.Unlock()

	pid, err := strconv.Atoi(h.Info.Pid)
	if err != nil {
		h.logger.Info(fmt.Sprintf("ERROR Firecracker-task-driver Could not parse pid=%s after initialization", h.Info.Pid))
		h.stateLock.Lock()
		h.State = drivers.TaskStateExited
		h.exitResult.ExitCode = 127
		h.exitResult.Signal = 0
		h.completedAt = time.Now()
		h.stateLock.Unlock()
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
	h.stateLock.Lock()
	defer h.stateLock.Unlock()

	h.State = drivers.TaskStateExited
	h.exitResult.ExitCode = 0
	h.exitResult.Signal = 0
	h.completedAt = time.Now()
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

		h.stateLock.Lock()
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
		h.stateLock.Unlock()

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

func keysToVal(line string) (string, uint64, error) {
	tokens := strings.Split(line, " ")
	if len(tokens) != 2 {
		return "", 0, fmt.Errorf("line isn't a k/v pair")
	}
	key := tokens[0]
	val, err := strconv.ParseUint(tokens[1], 10, 64)
	return key, val, err
}

func (h *taskHandle) Signal(sig string) error {

	pid, errpid := strconv.Atoi(h.Info.Pid)
	if errpid != nil {
		return fmt.Errorf("ERROR Firecracker-task-driver Could not parse pid=%s", h.Info.Pid)
	}
	p, err := os.FindProcess(pid)
	if err != nil {
		return fmt.Errorf("ERROR Firecracker-task-driver Could not find process to send signal")
	}

	switch sig {

	case "SIGTERM":
		p.Signal(syscall.SIGTERM)
	case "SIGHUP":
		p.Signal(syscall.SIGHUP)
	case "SIGABRT":
		p.Signal(syscall.SIGABRT)
	default:
		return fmt.Errorf("Firecracker-task-driver SIGNAL NOT SUPPORTED")
	}
	return nil
}

// shutdown shuts down the container, with `timeout` grace period
// before shutdown vm
func (h *taskHandle) shutdown(timeout time.Duration) error {
	time.Sleep(timeout)
	h.MachineInstance.StopVMM()
	return nil
}

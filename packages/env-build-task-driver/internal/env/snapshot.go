package env

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	"github.com/go-openapi/strfmt"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/client/client"
	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/client/client/operations"
	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/client/models"
	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/telemetry"
)

const (
	fcMaskLong   = "255.255.255.252"
	fcMacAddress = "02:FC:00:00:00:05"
	fcAddr       = "169.254.0.21"
	fcMask       = "/30"

	fcIfaceID  = "eth0"
	tmpDirPath = "/tmp"
)

type Snapshot struct {
	socketPath string
	client     *client.Firecracker

	fc *exec.Cmd

	env *Env
}

func newFirecrackerClient(socketPath string) *client.Firecracker {
	httpClient := client.NewHTTPClient(strfmt.NewFormats())

	transport := firecracker.NewUnixSocketTransport(socketPath, nil, false)
	httpClient.SetTransport(transport)

	return httpClient
}

func NewSnapshot(ctx context.Context, tracer trace.Tracer, env *Env, network *FCNetwork, rootfs *Rootfs) (*Snapshot, error) {
	socketFileName := fmt.Sprintf("fc-sock-%s.sock", env.BuildID)
	socketPath := filepath.Join(tmpDirPath, socketFileName)

	client := newFirecrackerClient(socketPath)

	var err error

	snapshot := &Snapshot{
		socketPath: socketPath,
		client:     client,
		env:        env,
		fc:         nil,
	}

	defer snapshot.cleanupFC(ctx, tracer)

	err = snapshot.startFCProcess(ctx, tracer, env.FirecrackerBinaryPath, network.namespaceID)
	if err != nil {
		return nil, err
	}

	err = snapshot.configure(ctx, tracer)
	if err != nil {
		return nil, err
	}

	err = snapshot.pause(ctx, tracer)
	if err != nil {
		return nil, err
	}

	// TODO: Wait for all necessary things in FC to start

	err = snapshot.snapshot(ctx, tracer)
	if err != nil {
		return nil, err
	}

	return snapshot, nil
}

func (s *Snapshot) startFCProcess(ctx context.Context, tracer trace.Tracer, fcBinaryPath, networkNamespaceID string) error {
	childCtx, childSpan := tracer.Start(ctx, "start-fc")
	defer childSpan.End()

	s.fc = exec.CommandContext(childCtx, "ip", "netns", "exec", networkNamespaceID, fcBinaryPath, "--api-sock", s.socketPath)
	s.fc.Stderr = os.Stderr
	s.fc.Stdout = os.Stdout

	err := s.fc.Start()
	if err != nil {
		errMsg := fmt.Errorf("error starting fc process %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	// TODO: Need to check and wait if the FC is alive
	time.Sleep(500 * time.Millisecond)

	telemetry.ReportEvent(childCtx, "started fc process")

	go func() {
		err := s.fc.Wait()
		if err != nil {
			errMsg := fmt.Errorf("error waiting for fc process %w", err)
			telemetry.ReportError(childCtx, errMsg)
		}
	}()

	return nil
}

func (s *Snapshot) configure(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "start-fc")
	defer childSpan.End()

	ip := fmt.Sprintf("%s::%s:%s:instance:eth0:off:8.8.8.8", fcAddr, fcTapAddress, fcMaskLong)
	kernelArgs := fmt.Sprintf("ip=%s reboot=k panic=1 pci=off nomodules i8042.nokbd i8042.noaux ipv6.disable=1 random.trust_cpu=on", ip)
	kernelImagePath := s.env.KernelImagePath
	bootSourceConfig := operations.PutGuestBootSourceParams{
		Context: childCtx,
		Body: &models.BootSource{
			BootArgs:        kernelArgs,
			KernelImagePath: &kernelImagePath,
		},
	}

	_, err := s.client.Operations.PutGuestBootSource(&bootSourceConfig)
	if err != nil {
		errMsg := fmt.Errorf("error setting fc boot source config %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}
	telemetry.ReportEvent(childCtx, "set fc boot source config")

	rootfs := "rootfs"
	isRootDevice := true
	isReadOnly := false
	pathOnHost := s.env.tmpRootfsPath()
	driversConfig := operations.PutGuestDriveByIDParams{
		Context: childCtx,
		DriveID: rootfs,
		Body: &models.Drive{
			DriveID:      &rootfs,
			PathOnHost:   &pathOnHost,
			IsRootDevice: &isRootDevice,
			IsReadOnly:   &isReadOnly,
		},
	}

	_, err = s.client.Operations.PutGuestDriveByID(&driversConfig)
	if err != nil {
		errMsg := fmt.Errorf("error setting fc drivers config %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	telemetry.ReportEvent(childCtx, "set fc drivers config")

	ifaceID := fcIfaceID
	hostDevName := fcTapName
	networkConfig := operations.PutGuestNetworkInterfaceByIDParams{
		Context: childCtx,
		IfaceID: ifaceID,
		Body: &models.NetworkInterface{
			IfaceID:     &ifaceID,
			GuestMac:    fcMacAddress,
			HostDevName: &hostDevName,
		},
	}
	_, err = s.client.Operations.PutGuestNetworkInterfaceByID(&networkConfig)
	if err != nil {
		errMsg := fmt.Errorf("error setting fc network config %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	telemetry.ReportEvent(childCtx, "set fc network config")

	smt := true
	trackDirtyPages := true
	machineConfig := operations.PutMachineConfigurationParams{
		Context: childCtx,
		Body: &models.MachineConfiguration{
			VcpuCount:       &s.env.VCpuCount,
			MemSizeMib:      &s.env.MemoryMB,
			Smt:             &smt,
			TrackDirtyPages: &trackDirtyPages,
		},
	}
	_, err = s.client.Operations.PutMachineConfiguration(&machineConfig)
	if err != nil {
		errMsg := fmt.Errorf("error setting fc machine config %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	telemetry.ReportEvent(childCtx, "set fc machine config")

	mmdsVersion := "V2"
	mmdsConfig := operations.PutMmdsConfigParams{
		Context: childCtx,
		Body: &models.MmdsConfig{
			Version:           &mmdsVersion,
			NetworkInterfaces: []string{fcIfaceID},
		},
	}
	_, err = s.client.Operations.PutMmdsConfig(&mmdsConfig)
	if err != nil {
		errMsg := fmt.Errorf("error setting fc mmds config %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	telemetry.ReportEvent(childCtx, "set fc mmds config")

	// We may need to sleep 0.015s before start - previous configuration is processes asynchronously. How to do this sync or in one go?

	start := models.InstanceActionInfoActionTypeInstanceStart
	startActionParams := operations.CreateSyncActionParams{
		Context: childCtx,
		Info: &models.InstanceActionInfo{
			ActionType: &start,
		},
	}
	_, err = s.client.Operations.CreateSyncAction(&startActionParams)
	if err != nil {
		errMsg := fmt.Errorf("error starting fc %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	telemetry.ReportEvent(childCtx, "started fc")

	return nil
}

func (s *Snapshot) pause(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "pause-fc")
	defer childSpan.End()

	state := models.VMStatePaused
	pauseConfig := operations.PatchVMParams{
		Context: childCtx,
		Body: &models.VM{
			State: &state,
		},
	}

	_, err := s.client.Operations.PatchVM(&pauseConfig)
	if err != nil {
		errMsg := fmt.Errorf("error pausing vm %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	telemetry.ReportEvent(childCtx, "paused vm")

	return nil
}

func (s *Snapshot) snapshot(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "snapshot-fc")
	defer childSpan.End()

	memfilePath := s.env.tmpMemfilePath()
	snapfilePath := s.env.tmpSnapfilePath()
	snapshotConfig := operations.CreateSnapshotParams{
		Context: childCtx,
		Body: &models.SnapshotCreateParams{
			SnapshotType: models.SnapshotCreateParamsSnapshotTypeFull,
			MemFilePath:  &memfilePath,
			SnapshotPath: &snapfilePath,
		},
	}

	_, err := s.client.Operations.CreateSnapshot(&snapshotConfig)
	if err != nil {
		errMsg := fmt.Errorf("error creating vm snapshot %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	telemetry.ReportEvent(childCtx, "created vm snapshot")

	return nil
}

func (s *Snapshot) cleanupFC(ctx context.Context, tracer trace.Tracer) {
	if s.fc != nil {
		err := s.fc.Cancel()
		if err != nil {
			errMsg := fmt.Errorf("error killing fc process %w", err)
			telemetry.ReportError(ctx, errMsg)
		}
		telemetry.ReportEvent(ctx, "killed fc process")
	}

	err := os.RemoveAll(s.socketPath)
	if err != nil {
		errMsg := fmt.Errorf("error removing fc socket %w", err)
		telemetry.ReportError(ctx, errMsg)
	}
	telemetry.ReportEvent(ctx, "removed fc socket")
}

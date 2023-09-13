package env

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/client/client"
	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/client/client/operations"
	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/client/models"
	"github.com/e2b-dev/api/packages/env-build-task-driver/internal/telemetry"
	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	"github.com/go-openapi/strfmt"
	"go.opentelemetry.io/otel/trace"
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

	snapshot := &Snapshot{
		socketPath: socketPath,
		client:     client,
	}

	err := snapshot.start(ctx, tracer)
	if err != nil {
		return nil, err
	}

	err = snapshot.pause(ctx, tracer)
	if err != nil {
		return nil, err
	}

	err = snapshot.snapshot(ctx, tracer)
	if err != nil {
		return nil, err
	}

	return snapshot, nil
}

func (s *Snapshot) start(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "start-fc")
	defer childSpan.End()

	ip := fmt.Sprintf("%s::%s:%s:instance:eth0:off:8.8.8.8", fcAddr, fcTapAddress, fcMaskLong)
	kernelArgs := fmt.Sprintf("ip=%s reboot=k panic=1 pci=off nomodules i8042.nokbd i8042.noaux ipv6.disable=1 random.trust_cpu=on", ip)
	bootSourceConfig := operations.PutGuestBootSourceParams{
		Context: childCtx,
		Body: &models.BootSource{
			BootArgs:        kernelArgs,
			KernelImagePath: &s.env.KernelImagePath,
		},
	}
	_, err := s.client.Operations.PutGuestBootSource(&bootSourceConfig)
	if err != nil {
		errMsg := fmt.Errorf("error setting fc boot source config %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}

	rootfs := "rootfs"
	isRootDevice := true
	isReadOnly := false
	pathOnHost := s.env.tmpRootfsPath
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

	// We may need to sleep 0.015s before start - previous configuration is processes asynchronously. How to do this sync or in one go?

	start := models.InstanceActionInfoActionTypeInstanceStart
	startActionParams := operations.CreateSyncActionParams{
		Context: childCtx,
		Info: &models.InstanceActionInfo{
			ActionType: &start,
		},
	}

	// TODO: Do we need to change namespace here?
	startAction, err := s.client.Operations.CreateSyncAction(&startActionParams)
	if err != nil {
		errMsg := fmt.Errorf("error starting fc %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}

	// TODO: How to get the PID or how to kill the FC process via socket?
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
		errMsg := fmt.Errorf("error pausing vm %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}

	return nil
}

func (s *Snapshot) snapshot(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "snapshot-fc")
	defer childSpan.End()

	snapshotConfig := operations.CreateSnapshotParams{
		Context: childCtx,
		Body: &models.SnapshotCreateParams{
			SnapshotType: models.SnapshotCreateParamsSnapshotTypeFull,
			MemFilePath:  &s.env.tmpMemfilePath,
			SnapshotPath: &s.env.tmpSnapfilePath,
		},
	}
	_, err := s.client.Operations.CreateSnapshot(&snapshotConfig)
	if err != nil {
		errMsg := fmt.Errorf("error creating vm snapshot %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}

	return nil

}

func (s *Snapshot) Cleanup(ctx context.Context, tracer trace.Tracer) error {
	// TODO: Kill FC process

	err := os.RemoveAll(s.socketPath)
	if err != nil {
		return err
	}

	return nil
}

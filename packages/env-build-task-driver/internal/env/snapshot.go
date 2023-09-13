package env

import (
	"context"
	"fmt"
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

	// TODO: Add more detailed tracing here

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

	rootfs := rootfsName
	isRootDevice := true
	isReadOnly := false
	pathOnHost := s.env.BuildRootfs
	driversConfig := operations.PutGuestDriveByIDParams{
		Context: childCtx,
		Body: &models.Drive{
			DriveID:      &rootfs,
			PathOnHost:   &pathOnHost,
			IsRootDevice: &isRootDevice,
			IsReadOnly:   &isReadOnly,
		},
	}

	ifaceID := fcIfaceID
	hostDevName := fcTapName
	networkConfig := operations.PutGuestNetworkInterfaceByIDParams{
		Context: childCtx,
		Body: &models.NetworkInterface{
			IfaceID:     &ifaceID,
			GuestMac:    fcMacAddress,
			HostDevName: &hostDevName,
		},
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

	mmdsVersion := "V2"
	mmdsConfig := operations.PutMmdsConfigParams{
		Context: childCtx,
		Body: &models.MmdsConfig{
			Version:           &mmdsVersion,
			NetworkInterfaces: []string{fcIfaceID},
		},
	}

	// function startfc() {
	//   local kernel_args="ip=$FC_ADDR::$TAP_ADDR:$MASK_LONG:instance:eth0:off:8.8.8.8"
	//   kernel_args="$kernel_args reboot=k panic=1 pci=off nomodules i8042.nokbd i8042.noaux ipv6.disable=1 random.trust_cpu=on"

	//	local config="vmconfig.json"
	//	cat <<EOF >$config
	//
	//	{
	//	  "boot-source": {
	//	    "kernel_image_path": "/fc-vm/vmlinux.bin",
	//	    "boot_args": "$kernel_args"
	//	  },
	//	  "drives":[
	//	   {
	//	      "drive_id": "rootfs",
	//	      "path_on_host": "$BUILD_FC_ROOTFS",
	//	      "is_root_device": true,
	//	      "is_read_only": false
	//	    }
	//	  ],
	//	  "network-interfaces": [
	//	    {
	//	      "iface_id": "eth0",
	//	      "guest_mac": "$FC_MAC",
	//	      "host_dev_name": "$TAP_NAME"
	//	    }
	//	  ],
	//	  "machine-config": {
	//	    "vcpu_count": 2,
	//	    "smt": true,
	//	    "mem_size_mib": 1024,
	//	    "track_dirty_pages": true
	//	  },
	//	  "mmds-config": {
	//	    "network_interfaces": ["eth0"],
	//	    "version": "V2"
	//	  }
	//	}
	//
	// EOF

	// How to call this with normal API?

	// We may need to sleep 0.015 befores start

	// TODO: Do we need to change namespace here?

	//	ip netns exec $NS_NAME firecracker \
	//	--api-sock $FC_SOCK \
	//	--config-file $config &
	//
	// FC_PID=$!
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
			MemFilePath:  &s.env.MemfilePath,
			SnapshotPath: &s.env.SnapfilePath,
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

	// Remove TMP files
}

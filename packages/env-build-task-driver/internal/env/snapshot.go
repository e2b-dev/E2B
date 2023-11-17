package env

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	firecracker "github.com/firecracker-microvm/firecracker-go-sdk"
	"github.com/go-openapi/strfmt"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/shared/pkg/fc/client"
	"github.com/e2b-dev/infra/packages/shared/pkg/fc/client/operations"
	"github.com/e2b-dev/infra/packages/shared/pkg/fc/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const (
	fcMaskLong   = "255.255.255.252"
	fcMacAddress = "02:FC:00:00:00:05"
	fcAddr       = "169.254.0.21"
	fcMask       = "/30"

	fcIfaceID  = "eth0"
	tmpDirPath = "/tmp"

	socketReadyCheckInterval = 100 * time.Millisecond
	socketWaitTimeout        = 2 * time.Second

	waitTimeForFCConfig = 500 * time.Millisecond
)

type Snapshot struct {
	fc     *exec.Cmd
	client *client.Firecracker

	env        *Env
	socketPath string
}

func waitForSocket(socketPath string, timeout time.Duration) error {
	start := time.Now()

	for {
		_, err := os.Stat(socketPath)
		if err == nil {
			// Socket file exists
			return nil
		} else if os.IsNotExist(err) {
			// Socket file doesn't exist yet

			// Check if timeout has been reached
			elapsed := time.Since(start)
			if elapsed >= timeout {
				return fmt.Errorf("timeout reached while waiting for socket file")
			}

			// Wait for a short duration before checking again
			time.Sleep(socketReadyCheckInterval)
		} else {
			// Error occurred while checking for socket file
			return err
		}
	}
}

func newFirecrackerClient(socketPath string) *client.Firecracker {
	httpClient := client.NewHTTPClient(strfmt.NewFormats())

	transport := firecracker.NewUnixSocketTransport(socketPath, nil, false)
	httpClient.SetTransport(transport)

	return httpClient
}

func NewSnapshot(ctx context.Context, tracer trace.Tracer, env *Env, network *FCNetwork, rootfs *Rootfs) (*Snapshot, error) {
	childCtx, childSpan := tracer.Start(ctx, "new-snapshot")
	defer childSpan.End()

	socketFileName := fmt.Sprintf("fc-sock-%s.sock", env.BuildID)
	socketPath := filepath.Join(tmpDirPath, socketFileName)

	client := newFirecrackerClient(socketPath)

	snapshot := &Snapshot{
		socketPath: socketPath,
		client:     client,
		env:        env,
		fc:         nil,
	}

	defer snapshot.cleanupFC(childCtx, tracer)

	err := snapshot.startFCProcess(childCtx, tracer, env.FirecrackerBinaryPath, network.namespaceID)
	if err != nil {
		errMsg := fmt.Errorf("error starting fc process %w", err)

		return nil, errMsg
	}

	err = snapshot.configureFC(childCtx, tracer)
	if err != nil {
		errMsg := fmt.Errorf("error configuring fc %w", err)

		return nil, errMsg
	}

	// Wait for all necessary things in FC to start
	// TODO: Maybe init should signalize when it's ready?
	time.Sleep(10 * time.Second)

	err = snapshot.pauseFC(childCtx, tracer)
	if err != nil {
		errMsg := fmt.Errorf("error pausing fc %w", err)

		return nil, errMsg
	}

	err = snapshot.snapshotFC(childCtx, tracer)
	if err != nil {
		errMsg := fmt.Errorf("error snapshotting fc %w", err)

		return nil, errMsg
	}

	return snapshot, nil
}

func (s *Snapshot) startFCProcess(ctx context.Context, tracer trace.Tracer, fcBinaryPath, networkNamespaceID string) error {
	childCtx, childSpan := tracer.Start(ctx, "start-fc-process")
	defer childSpan.End()

	s.fc = exec.CommandContext(childCtx, "ip", "netns", "exec", networkNamespaceID, fcBinaryPath, "--api-sock", s.socketPath)

	fcVMStdoutWriter := telemetry.NewEventWriter(childCtx, "stdout")
	fcVMStderrWriter := telemetry.NewEventWriter(childCtx, "stderr")

	stdoutPipe, err := s.fc.StdoutPipe()
	if err != nil {
		errMsg := fmt.Errorf("error creating fc stdout pipe %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	stderrPipe, err := s.fc.StderrPipe()
	if err != nil {
		errMsg := fmt.Errorf("error creating fc stderr pipe %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		closeErr := stdoutPipe.Close()
		if closeErr != nil {
			closeErrMsg := fmt.Errorf("error closing fc stdout pipe %w", closeErr)
			telemetry.ReportError(childCtx, closeErrMsg)
		}

		return errMsg
	}

	var outputWaitGroup sync.WaitGroup

	outputWaitGroup.Add(1)
	go func() {
		scanner := bufio.NewScanner(stdoutPipe)

		for scanner.Scan() {
			line := scanner.Text()
			fcVMStdoutWriter.Write([]byte(line))
		}

		outputWaitGroup.Done()
	}()

	outputWaitGroup.Add(1)
	go func() {
		scanner := bufio.NewScanner(stderrPipe)

		for scanner.Scan() {
			line := scanner.Text()
			fcVMStderrWriter.Write([]byte(line))
		}

		outputWaitGroup.Done()
	}()

	err = s.fc.Start()
	if err != nil {
		errMsg := fmt.Errorf("error starting fc process %w", err)
		telemetry.ReportCriticalError(childCtx, errMsg)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "started fc process")

	go func() {
		anonymousChildCtx, anonymousChildSpan := tracer.Start(ctx, "handle-fc-process-wait")
		defer anonymousChildSpan.End()

		outputWaitGroup.Wait()

		waitErr := s.fc.Wait()
		if err != nil {
			errMsg := fmt.Errorf("error waiting for fc process %w", waitErr)
			telemetry.ReportError(anonymousChildCtx, errMsg)
		} else {
			telemetry.ReportEvent(anonymousChildCtx, "fc process exited")
		}
	}()

	// Wait for the FC process to start so we can use FC API
	err = waitForSocket(s.socketPath, socketWaitTimeout)
	if err != nil {
		errMsg := fmt.Errorf("error waiting for fc socket %w", err)

		return errMsg
	}

	telemetry.ReportEvent(childCtx, "fc process created socket")

	return nil
}

func (s *Snapshot) configureFC(ctx context.Context, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "configure-fc")
	defer childSpan.End()

	ip := fmt.Sprintf("%s::%s:%s:instance:eth0:off:8.8.8.8", fcAddr, fcTapAddress, fcMaskLong)
	kernelArgs := fmt.Sprintf("console=ttyS0 ip=%s reboot=k panic=1 pci=off nomodules i8042.nokbd i8042.noaux ipv6.disable=1 random.trust_cpu=on", ip)
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

	// We may need to sleep before start - previous configuration is processes asynchronously. How to do this sync or in one go?
	time.Sleep(waitTimeForFCConfig)

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

func (s *Snapshot) pauseFC(ctx context.Context, tracer trace.Tracer) error {
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

	telemetry.ReportEvent(childCtx, "paused fc")

	return nil
}

func (s *Snapshot) snapshotFC(ctx context.Context, tracer trace.Tracer) error {
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
	childCtx, childSpan := tracer.Start(ctx, "cleanup-fc")
	defer childSpan.End()

	if s.fc != nil {
		err := s.fc.Cancel()
		if err != nil {
			errMsg := fmt.Errorf("error killing fc process %w", err)
			telemetry.ReportError(childCtx, errMsg)
		} else {
			telemetry.ReportEvent(childCtx, "killed fc process")
		}
	}

	err := os.RemoveAll(s.socketPath)
	if err != nil {
		errMsg := fmt.Errorf("error removing fc socket %w", err)
		telemetry.ReportError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "removed fc socket")
	}
}

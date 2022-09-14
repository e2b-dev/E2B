package firevm

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/cneira/firecracker-task-driver/driver/client/client/operations"
	"github.com/cneira/firecracker-task-driver/driver/client/models"
	"github.com/cneira/firecracker-task-driver/driver/env"
	"github.com/cneira/firecracker-task-driver/driver/slot"
	"github.com/cneira/firecracker-task-driver/driver/telemetry"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/trace"
)

func saveEditSnapshot(ctx context.Context, ipSlot *slot.IPSlot, info *Instance_info, tracer trace.Tracer) error {
	childCtx, childSpan := tracer.Start(ctx, "save-edit-snapshot")
	defer childSpan.End()

	httpClient := newFirecrackerClient(info.SocketPath)

	editID := uuid.New().String()

	newEditDirPath := filepath.Join(info.CodeSnippetDirectory, env.EditDirName, editID)

	os.MkdirAll(newEditDirPath, 0777)

	memfilePath := filepath.Join(newEditDirPath, env.MemfileName)
	snapfilePath := filepath.Join(newEditDirPath, env.SnapfileName)

	// Pause VM
	state := models.VMStatePaused
	pauseConfig := operations.PatchVMParams{
		Context: childCtx,
		Body: &models.VM{
			State: &state,
		},
	}
	_, err := httpClient.Operations.PatchVM(&pauseConfig)
	if err != nil {
		errMsg := fmt.Errorf("error pausing vm %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}

	// Create snapshot
	snapshotConfig := operations.CreateSnapshotParams{
		Context: childCtx,
		Body: &models.SnapshotCreateParams{
			SnapshotType: models.SnapshotCreateParamsSnapshotTypeFull,
			MemFilePath:  &memfilePath,
			SnapshotPath: &snapfilePath,
		},
	}
	_, err = httpClient.Operations.CreateSnapshot(&snapshotConfig)

	if err != nil {
		errMsg := fmt.Errorf("error creating vm snapshot %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}

	defer func() {
		if err != nil {
			rmErr := os.RemoveAll(newEditDirPath)
			if rmErr != nil {
				errMsg := fmt.Errorf("error removing edit dir %v", rmErr)
				telemetry.ReportError(childCtx, errMsg)
			}
		}
	}()

	rootfsPathSrc := filepath.Join(info.BuildDirPath, env.RootfsName)
	rootfsPathDest := filepath.Join(newEditDirPath, env.RootfsName)

	copyCmd := fmt.Sprintf("cp -pRd --reflink %s %s", rootfsPathSrc, rootfsPathDest)
	cmd := exec.CommandContext(ctx, "nsenter", "-t", info.Pid, "-m", "--", "bash", "-c", copyCmd)

	_, err = cmd.Output()
	if err != nil {
		errMsg := fmt.Errorf("failed copying rootfs: %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}

	editIDPath := filepath.Join(info.CodeSnippetDirectory, env.EditDirName, env.EditIDName)
	err = os.WriteFile(editIDPath, []byte(editID), 0777)
	if err != nil {
		errMsg := fmt.Errorf("unable to create edit_id file: %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
		return errMsg
	}
	return nil
}

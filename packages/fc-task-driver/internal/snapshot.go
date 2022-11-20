package internal

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/KarpelesLab/reflink"
	"github.com/devbookhq/packages/firecracker-task-driver/internal/client/client/operations"
	"github.com/devbookhq/packages/firecracker-task-driver/internal/client/models"
	"github.com/devbookhq/packages/firecracker-task-driver/internal/env"
	"github.com/devbookhq/packages/firecracker-task-driver/internal/slot"
	"github.com/devbookhq/packages/firecracker-task-driver/internal/telemetry"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/trace"
)

func saveEditSnapshot(
	ctx context.Context,
	ipSlot *slot.IPSlot,
	fsEnv *env.Env,
	info *Instance_info,
	tracer trace.Tracer,
) error {
	childCtx, childSpan := tracer.Start(ctx, "save-edit-snapshot")
	defer childSpan.End()

	httpClient := newFirecrackerClient(info.SocketPath)

	editID := uuid.New().String()

	newEditDirPath := filepath.Join(info.CodeSnippetDirectory, env.EditDirName, editID)

	err := os.MkdirAll(newEditDirPath, 0777)
	if err != nil {
		telemetry.ReportCriticalError(childCtx, err)
	}

	defer func() {
		if err != nil {
			rmErr := os.RemoveAll(newEditDirPath)
			if rmErr != nil {
				errMsg := fmt.Errorf("error removing new edit dir after failed edit snapshot %v", rmErr)
				telemetry.ReportError(childCtx, errMsg)
			}
		}
	}()

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
	_, err = httpClient.Operations.PatchVM(&pauseConfig)
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

	rootfsPathSrc := filepath.Join(fsEnv.SessionEnvPath, env.RootfsName)
	rootfsPathDest := filepath.Join(newEditDirPath, env.RootfsName)

	err = reflink.Always(rootfsPathSrc, rootfsPathDest)
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

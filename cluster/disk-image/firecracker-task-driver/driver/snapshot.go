package firevm

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/cneira/firecracker-task-driver/driver/client/client/operations"
	"github.com/cneira/firecracker-task-driver/driver/client/models"
	"github.com/google/uuid"
)

func saveEditSnapshot(ipSlot *IPSlot, info *Instance_info) error {
	ctx := context.Background()

	httpClient := newFirecrackerClient(info.SocketPath)

	editID := uuid.New().String()

	newEditDirPath := filepath.Join(info.CodeSnippetDirectory, editDirName, editID)

	os.MkdirAll(newEditDirPath, 0777)

	memfilePath := filepath.Join(newEditDirPath, memfileName)
	snapfilePath := filepath.Join(newEditDirPath, snapfileName)

	// Pause VM
	state := models.VMStatePaused
	pauseConfig := operations.PatchVMParams{
		Context: ctx,
		Body: &models.VM{
			State: &state,
		},
	}
	_, err := httpClient.Operations.PatchVM(&pauseConfig)
	if err != nil {
		return fmt.Errorf("error pausing vm %v", err)
	}

	// Create snapshot
	snapshotConfig := operations.CreateSnapshotParams{
		Context: ctx,
		Body: &models.SnapshotCreateParams{
			SnapshotType: models.SnapshotCreateParamsSnapshotTypeFull,
			MemFilePath:  &memfilePath,
			SnapshotPath: &snapfilePath,
		},
	}
	_, err = httpClient.Operations.CreateSnapshot(&snapshotConfig)

	if err != nil {
		return fmt.Errorf("error creating vm snapshot %v", err)
	}
	defer func() {
		if err != nil {
			os.RemoveAll(newEditDirPath)
		}
	}()

	rootfsPathSrc := filepath.Join(info.BuildDirPath, rootfsName)
	rootfsPathDest := filepath.Join(newEditDirPath, rootfsName)

	copyCmd := fmt.Sprintf("cp %s %s", rootfsPathSrc, rootfsPathDest)
	cmd := exec.CommandContext(ctx, "nsenter", "-t", info.Pid, "-m", "--", "bash", "-c", copyCmd)

	_, err = cmd.Output()
	if err != nil {
		return fmt.Errorf("failed copying rootfs: %v", err)
	}

	editIDPath := filepath.Join(info.CodeSnippetDirectory, editDirName, editIDName)
	err = os.WriteFile(editIDPath, []byte(editID), 0777)
	if err != nil {
		return fmt.Errorf("unable to create edit_id file: %v", err)
	}
	return nil
}

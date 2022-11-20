package env

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/KarpelesLab/reflink"
	"github.com/devbookhq/packages/firecracker-task-driver/internal/slot"
	"github.com/devbookhq/packages/firecracker-task-driver/internal/telemetry"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const (
	EditIDName          = "edit_id"
	BuildIDName         = "build_id"
	TemplateIDName      = "template_id"
	TemplateBuildIDName = "template_build_id"
	RootfsName          = "rootfs.ext4"
	SnapfileName        = "snapfile"
	MemfileName         = "memfile"

	EditDirName        = "edit"
	BuildDirName       = "builds"
	SessionEnvsDirName = "session-envs"
)

type Env struct {
	SnapshotRootPath   string
	BuildDirPath       string
	CodeSnippetEnvPath string
	EditID             *string
	SessionEnvPath     string
}

func New(
	ctx context.Context,
	slot *slot.IPSlot,
	codeSnippetID string,
	fcEnvsDisk string,
	editEnabled bool,
	tracer trace.Tracer,
) (*Env, error) {
	childCtx, childSpan := tracer.Start(ctx, "create-env",
		trace.WithAttributes(
			attribute.String("code_snippet_id", codeSnippetID),
			attribute.String("fc_envs_disk", fcEnvsDisk),
			attribute.Bool("edit_enabled", editEnabled),
		),
	)
	defer childSpan.End()

	codeSnippetEnvPath := filepath.Join(fcEnvsDisk, codeSnippetID)
	sessionEnvPath := filepath.Join(codeSnippetEnvPath, SessionEnvsDirName, slot.SessionID)

	err := os.MkdirAll(sessionEnvPath, 0777)
	if err != nil {
		telemetry.ReportError(childCtx, err)
	}

	var buildDirPath string
	var snapshotRootPath string
	var editID string

	if editEnabled {
		// Use the shared edit sessions
		codeSnippetEditPath := filepath.Join(codeSnippetEnvPath, EditDirName)

		buildIDSrc := filepath.Join(codeSnippetEnvPath, BuildIDName)
		buildIDDest := filepath.Join(codeSnippetEditPath, BuildIDName)

		templateIDSrc := filepath.Join(codeSnippetEnvPath, TemplateIDName)
		templateIDDest := filepath.Join(codeSnippetEditPath, TemplateIDName)

		templateBuildIDSrc := filepath.Join(codeSnippetEnvPath, TemplateBuildIDName)
		templateBuildIDDest := filepath.Join(codeSnippetEditPath, TemplateBuildIDName)

		editIDPath := filepath.Join(codeSnippetEditPath, EditIDName)

		err := os.MkdirAll(codeSnippetEditPath, 0777)
		if err != nil {
			telemetry.ReportError(childCtx, err)
		}

		if _, err := os.Stat(editIDPath); err == nil {
			// If the edit_file exists we expect that the other files will exists too (we are creating te edit last)
			data, err := os.ReadFile(editIDPath)
			if err != nil {
				return nil, fmt.Errorf("failed reading edit id for the code snippet %s: %v", codeSnippetID, err)
			}
			editID = string(data)

			snapshotRootPath = filepath.Join(codeSnippetEditPath, editID)
		} else {
			// Link the fc files from the root CS directory and create edit_id
			editID = uuid.New().String()

			snapshotRootPath = filepath.Join(codeSnippetEditPath, editID)
			err = os.MkdirAll(snapshotRootPath, 0777)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			rootfsSrc := filepath.Join(codeSnippetEnvPath, RootfsName)
			rootfsDest := filepath.Join(codeSnippetEditPath, editID, RootfsName)

			snapfileSrc := filepath.Join(codeSnippetEnvPath, SnapfileName)
			snapfileDest := filepath.Join(codeSnippetEditPath, editID, SnapfileName)

			memfileSrc := filepath.Join(codeSnippetEnvPath, MemfileName)
			memfileDest := filepath.Join(codeSnippetEditPath, editID, MemfileName)

			err = reflink.Always(rootfsSrc, rootfsDest)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			err = reflink.Always(snapfileSrc, snapfileDest)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			err = reflink.Always(memfileSrc, memfileDest)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			err = reflink.Always(buildIDSrc, buildIDDest)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			err = reflink.Always(templateIDSrc, templateIDDest)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			err = reflink.Always(templateBuildIDSrc, templateBuildIDDest)
			if err != nil {
				telemetry.ReportError(childCtx, err)
			}

			err := os.WriteFile(editIDPath, []byte(editID), 0777)
			if err != nil {
				errMsg := fmt.Errorf("unable to create edit_id file: %v", err)
				telemetry.ReportError(childCtx, errMsg)
			}
		}

		if _, err := os.Stat(buildIDDest); err != nil {
			// If the build_id file does not exist this envs is templated - we check to which env the template points to and use that as our new "virtual" env
			data, err := os.ReadFile(templateIDDest)
			if err != nil {
				return nil, fmt.Errorf("failed reading template id for the code snippet %s: %v", codeSnippetID, err)
			}
			templateID := string(data)

			templateEnvPath := filepath.Join(fcEnvsDisk, templateID)

			data, err = os.ReadFile(templateBuildIDDest)
			if err != nil {
				return nil, fmt.Errorf("failed reading build id for the template %s of code snippet %s: %v", templateID, codeSnippetID, err)
			}
			templateBuildID := string(data)
			buildDirPath = filepath.Join(templateEnvPath, BuildDirName, templateBuildID)
		} else {
			// build_id is present so this is a non-templated session
			data, err := os.ReadFile(buildIDDest)
			if err != nil {
				return nil, fmt.Errorf("failed reading build id for the code snippet %s: %v", codeSnippetID, err)
			}
			buildID := string(data)
			buildDirPath = filepath.Join(codeSnippetEnvPath, BuildDirName, buildID)
		}

		err = os.MkdirAll(buildDirPath, 0777)
		if err != nil {
			telemetry.ReportError(childCtx, err)
		}

		err = reflink.Always(
			filepath.Join(snapshotRootPath, "rootfs.ext4"),
			filepath.Join(sessionEnvPath, "rootfs.ext4"),
		)
		if err != nil {
			errMsg := fmt.Errorf("error creating reflinked rootfs %v", err)
			telemetry.ReportCriticalError(childCtx, errMsg)
			return nil, errMsg
		}

		childSpan.SetAttributes(
			attribute.String("session_env_path", sessionEnvPath),
			attribute.String("snapshot_root_path", snapshotRootPath),
			attribute.String("build_dir_path", buildDirPath),
			attribute.String("code_snippet_env_path", codeSnippetEnvPath),
			attribute.String("edit_id", editID),
		)

		return &Env{
			SessionEnvPath:     sessionEnvPath,
			SnapshotRootPath:   snapshotRootPath,
			BuildDirPath:       buildDirPath,
			CodeSnippetEnvPath: codeSnippetEnvPath,
			EditID:             &editID,
		}, nil

	} else {
		// Mount overlay
		snapshotRootPath = codeSnippetEnvPath

		templateIDPath := filepath.Join(codeSnippetEnvPath, TemplateIDName)
		templateBuildIDPath := filepath.Join(codeSnippetEnvPath, TemplateBuildIDName)
		buildIDPath := filepath.Join(codeSnippetEnvPath, BuildIDName)

		if _, err := os.Stat(buildIDPath); err != nil {
			// If the build_id file does not exist this envs is templated - we check to which env the template points to and use that as our new "virtual" env
			data, err := os.ReadFile(templateIDPath)
			if err != nil {
				return nil, fmt.Errorf("failed reading template id for the code snippet %s: %v", codeSnippetID, err)
			}
			templateID := string(data)

			templateEnvPath := filepath.Join(fcEnvsDisk, templateID)

			data, err = os.ReadFile(templateBuildIDPath)
			if err != nil {
				return nil, fmt.Errorf("failed reading build id for the template %s of code snippet %s: %v", templateID, codeSnippetID, err)
			}
			templateBuildID := string(data)
			buildDirPath = filepath.Join(templateEnvPath, BuildDirName, templateBuildID)
		} else {
			// build_id is present and this is a normal non-templated and non-edit session
			data, err := os.ReadFile(buildIDPath)
			if err != nil {
				return nil, fmt.Errorf("failed reading build id for the code snippet %s: %v", codeSnippetID, err)
			}
			buildID := string(data)
			buildDirPath = filepath.Join(codeSnippetEnvPath, BuildDirName, buildID)
		}

		err := os.MkdirAll(buildDirPath, 0777)
		if err != nil {
			telemetry.ReportError(childCtx, err)
		}

		err = reflink.Always(
			filepath.Join(snapshotRootPath, "rootfs.ext4"),
			filepath.Join(sessionEnvPath, "rootfs.ext4"),
		)
		if err != nil {
			errMsg := fmt.Errorf("error creating reflinked rootfs %v", err)
			telemetry.ReportCriticalError(childCtx, errMsg)
			return nil, errMsg
		}

		childSpan.SetAttributes(
			attribute.String("session_env_path", sessionEnvPath),
			attribute.String("snapshot_root_path", snapshotRootPath),
			attribute.String("build_dir_path", buildDirPath),
			attribute.String("code_snippet_env_path", codeSnippetEnvPath),
		)

		return &Env{
			SessionEnvPath:     sessionEnvPath,
			SnapshotRootPath:   snapshotRootPath,
			BuildDirPath:       buildDirPath,
			CodeSnippetEnvPath: codeSnippetEnvPath,
		}, nil
	}
}

func (env *Env) Delete(
	ctx context.Context,
	tracer trace.Tracer,
) error {
	childCtx, childSpan := tracer.Start(ctx, "delete-env",
		trace.WithAttributes(
			attribute.String("session_env_path", env.SessionEnvPath),
			attribute.String("snapshot_root_path", env.SnapshotRootPath),
			attribute.String("build_dir_path", env.BuildDirPath),
			attribute.String("code_snippet_env_path", env.CodeSnippetEnvPath),
		),
	)
	defer childSpan.End()

	if env.EditID != nil {
		childSpan.SetAttributes(
			attribute.String("edit_id", *env.EditID),
		)
	}

	err := os.RemoveAll(env.SessionEnvPath)
	if err != nil {
		errMsg := fmt.Errorf("error deleting session env files %v", err)
		telemetry.ReportCriticalError(childCtx, errMsg)
	}

	return nil
}

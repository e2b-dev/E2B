package template

import (
	"context"
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	artifactregistry "cloud.google.com/go/artifactregistry/apiv1"
	"cloud.google.com/go/artifactregistry/apiv1/artifactregistrypb"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/shared/pkg/storages"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

type Template struct {
	// Unique ID of the env.
	TemplateID string

	// GCP region
	Region string
	// GCP projectID
	ProjectID string

	// Path to the directory where all docker contexts are stored. This directory is a FUSE mounted bucket where the contexts were uploaded.
	DockerContextsPath string
	// Docker registry where the docker images are uploaded for archivation/caching.
	DockerRegistryName string
	// Path to the directory where all envs are stored.
	EnvsDiskPath string
	// Name of the bucket where the envs are stored.
	BucketName string
}

// TemplateDirPath is the directory where the built template is stored.
func (t *Template) TemplateDirPath() string {
	return filepath.Join(t.EnvsDiskPath, t.TemplateID)
}

func (t *Template) Delete(ctx context.Context, tracer trace.Tracer, artifactRegistry *artifactregistry.Client, storage *storages.GoogleCloudStorage) error {
	childCtx, childSpan := tracer.Start(ctx, "delete")
	defer childSpan.End()

	info, err := os.Stat(t.TemplateDirPath())
	if err != nil {
		if os.IsNotExist(err) {
			telemetry.ReportCriticalError(childCtx, fmt.Errorf("template directory does not exist: %w", err))

			return fmt.Errorf("template directory does not exist: %w", err)
		}

		telemetry.ReportCriticalError(childCtx, fmt.Errorf("error when getting template directory info: %w", err))

		return fmt.Errorf("error when getting template directory info: %w", err)
	}

	if !info.IsDir() {
		telemetry.ReportCriticalError(childCtx, fmt.Errorf("template directory is not a directory"))

		return fmt.Errorf("template directory is not a directory")
	}

	err = os.RemoveAll(t.TemplateDirPath())
	if err != nil {
		telemetry.ReportCriticalError(childCtx, fmt.Errorf("error when deleting template directory: %w", err))

		return fmt.Errorf("error when deleting template directory: %w", err)
	}

	telemetry.ReportEvent(childCtx, "deleted template directory")

	dockerContextDelErr := storage.DeleteFolder(ctx, strings.Join([]string{"v1", t.TemplateID}, "/"))
	if dockerContextDelErr != nil {
		errMsg := fmt.Errorf("error when deleting template docker context from storage bucket: %w", dockerContextDelErr)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "deleted template docker context form storage bucket")
	}

	op, artifactRegistryDeleteErr := artifactRegistry.DeletePackage(ctx, &artifactregistrypb.DeletePackageRequest{Name: GetDockerImageURL(t.ProjectID, t.Region, t.DockerRegistryName) + t.TemplateID})
	if artifactRegistryDeleteErr != nil {
		errMsg := fmt.Errorf("error when deleting template image from registry: %w", artifactRegistryDeleteErr)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "started deleting template image from registry")

		err := op.Wait(childCtx)
		if err != nil {
			errMsg := fmt.Errorf("error when waiting for template image deleting from registry: %w", err)
			telemetry.ReportCriticalError(childCtx, errMsg)
		} else {
			telemetry.ReportEvent(childCtx, "deleted template image from registry")
		}
	}

	return nil
}

func GetDockerImageURL(gcpProjectID, gcpRegion, dockerRepositoryName string) string {
	// DockerImagesURL is the URL to the docker images in the artifact registry
	return "projects/" + gcpProjectID + "/locations/" + gcpRegion + "/repositories/" + dockerRepositoryName + "/packages/"
}

package server

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"cloud.google.com/go/artifactregistry/apiv1/artifactregistrypb"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/e2b-dev/infra/packages/shared/pkg/consts"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/template-manager"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func GetDockerImageURL(templateID string) string {
	// DockerImagesURL is the URL to the docker images in the artifact registry
	return fmt.Sprintf("projects/%s/locations/%s/repositories/%s/packages/", consts.GCPProject, consts.GCPRegion, consts.DockerRegistry) + templateID
}

func (s *serverStore) TemplateDelete(ctx context.Context, in *template_manager.TemplateDeleteRequest) (*emptypb.Empty, error) {
	childCtx, childSpan := s.tracer.Start(ctx, "template-delete")
	defer childSpan.End()

	templateID := in.TemplateID

	templateDirPath := filepath.Join(consts.EnvsDisk, templateID)
	info, err := os.Stat(templateDirPath)
	if err != nil {
		if os.IsNotExist(err) {
			telemetry.ReportCriticalError(childCtx, fmt.Errorf("template directory does not exist: %w", err))

			return nil, fmt.Errorf("template directory does not exist: %w", err)
		}

		telemetry.ReportCriticalError(childCtx, fmt.Errorf("error when getting template directory info: %w", err))

		return nil, fmt.Errorf("error when getting template directory info: %w", err)
	}

	if !info.IsDir() {
		telemetry.ReportCriticalError(childCtx, fmt.Errorf("template directory is not a directory"))

		return nil, fmt.Errorf("template directory is not a directory")
	}

	err = os.RemoveAll(templateDirPath)
	if err != nil {
		telemetry.ReportCriticalError(childCtx, fmt.Errorf("error when deleting template directory: %w", err))

		return nil, fmt.Errorf("error when deleting template directory: %w", err)
	}

	telemetry.ReportEvent(childCtx, "deleted template directory")

	op, artifactRegistryDeleteErr := s.artifactRegistry.DeletePackage(ctx, &artifactregistrypb.DeletePackageRequest{Name: GetDockerImageURL(templateID)})
	if artifactRegistryDeleteErr != nil {
		errMsg := fmt.Errorf("error when deleting template image from registry: %w", artifactRegistryDeleteErr)
		telemetry.ReportCriticalError(childCtx, errMsg)
	} else {
		telemetry.ReportEvent(childCtx, "started deleting template image from registry")

		waitErr := op.Wait(childCtx)
		if waitErr != nil {
			errMsg := fmt.Errorf("error when waiting for template image deleting from registry: %w", waitErr)
			telemetry.ReportCriticalError(childCtx, errMsg)
		} else {
			telemetry.ReportEvent(childCtx, "deleted template image from registry")
		}
	}

	return nil, nil
}

package server

import (
	"fmt"
	"path/filepath"
	"strconv"

	"go.opentelemetry.io/otel/attribute"
	"google.golang.org/grpc/metadata"

	"github.com/e2b-dev/infra/packages/shared/pkg/consts"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/template-manager"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"github.com/e2b-dev/infra/packages/template-manager/internal/build"
	"github.com/e2b-dev/infra/packages/template-manager/internal/build/writer"
)

func (s *serverStore) TemplateCreate(templateRequest *template_manager.TemplateCreateRequest, stream template_manager.TemplateService_TemplateCreateServer) error {
	ctx := stream.Context()
	childCtx, childSpan := s.tracer.Start(ctx, "template-create")
	defer childSpan.End()

	config := templateRequest.Template

	childSpan.SetAttributes(
		attribute.String("env.id", config.TemplateID),
		attribute.String("env.build.id", config.BuildID),
		attribute.String("env.kernel.version", config.KernelVersion),
		attribute.String("env.firecracker.version", config.FirecrackerVersion),
		attribute.String("env.start_cmd", config.StartCommand),
		attribute.Int64("env.memory_mb", int64(config.MemoryMB)),
		attribute.Int64("env.vcpu_count", int64(config.VCpuCount)),
		attribute.Bool("env.huge_pages", config.HugePages),
	)

	logsWriter := writer.New(stream)
	template := &build.Env{
		EnvID:                 config.TemplateID,
		BuildID:               config.BuildID,
		VCpuCount:             int64(config.VCpuCount),
		MemoryMB:              int64(config.MemoryMB),
		StartCmd:              config.StartCommand,
		DiskSizeMB:            int64(config.DiskSizeMB),
		HugePages:             config.HugePages,
		KernelVersion:         config.KernelVersion,
		FirecrackerBinaryPath: filepath.Join(consts.FirecrackerVersionsDir, config.FirecrackerVersion, consts.FirecrackerBinaryName),
		BuildLogsWriter:       logsWriter,
	}

	err := template.Build(childCtx, s.tracer, s.dockerClient, s.legacyDockerClient)
	if err != nil {
		telemetry.ReportCriticalError(childCtx, err)

		_, _ = logsWriter.Write([]byte(fmt.Sprintf("Error building environment: %v", err)))
		return err
	}

	trailerMetadata := metadata.Pairs(consts.RootfsSizeKey, strconv.FormatInt(template.RootfsSizeMB(), 10))
	stream.SetTrailer(trailerMetadata)

	telemetry.ReportEvent(childCtx, "Environment built")

	return nil
}

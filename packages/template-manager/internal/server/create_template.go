package server

import (
	"path/filepath"

	"github.com/e2b-dev/infra/packages/shared/pkg/consts"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/template-manager"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"github.com/e2b-dev/infra/packages/template-manager/internal/build/env"
	"github.com/e2b-dev/infra/packages/template-manager/internal/build/writer"
	"go.opentelemetry.io/otel/attribute"
)

func (s *serverStore) TemplateCreate(templateRequest *template_manager.TemplateCreateRequest, stream template_manager.TemplateService_TemplateCreateServer) error {
	ctx := stream.Context()
	childCtx, childSpan := s.tracer.Start(ctx, "env-create")
	defer childSpan.End()

	childSpan.SetAttributes(
		attribute.String("env.id", templateRequest.TemplateID),
		attribute.String("env.build.id", templateRequest.BuildID),
		attribute.String("env.kernel.version", templateRequest.KernelVersion),
		attribute.String("env.firecracker.version", templateRequest.FirecrackerVersion),
		attribute.String("env.start_cmd", templateRequest.StartCommand),
		attribute.Int64("env.memory_mb", int64(templateRequest.MemoryMB)),
		attribute.Int64("env.vcpu_count", int64(templateRequest.VCpuCount)),
		attribute.Bool("env.huge_pages", templateRequest.HugePages),
	)

	logsWriter := writer.New(stream)
	template := &env.Env{
		EnvID:                 templateRequest.TemplateID,
		BuildID:               templateRequest.BuildID,
		VCpuCount:             int64(templateRequest.VCpuCount),
		MemoryMB:              int64(templateRequest.MemoryMB),
		StartCmd:              templateRequest.StartCommand,
		DiskSizeMB:            int64(templateRequest.DiskSizeMB),
		HugePages:             templateRequest.HugePages,
		KernelVersion:         templateRequest.KernelVersion,
		FirecrackerBinaryPath: filepath.Join(consts.FirecrackerVersionsDir, templateRequest.FirecrackerVersion, consts.FirecrackerBinaryName),
		BuildLogsWriter:       logsWriter,
	}

	err := template.Build(childCtx, s.tracer, s.dockerClient, s.legacyDockerClient)
	if err != nil {
		telemetry.ReportCriticalError(childCtx, err)

		// TODO:
		logsWriter.Write([]byte(err.Error()))
		return err
	}

	telemetry.ReportEvent(childCtx, "Environment built")

	return nil
}

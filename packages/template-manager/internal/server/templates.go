package server

import (
	"context"
	"path/filepath"

	"go.opentelemetry.io/otel/attribute"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/e2b-dev/infra/packages/shared/pkg/consts"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/template-manager"
	"github.com/e2b-dev/infra/packages/template-manager/internal/build/env"
	"github.com/e2b-dev/infra/packages/template-manager/internal/build/writer"
)

func (s *serverStore) TemplateCreate(ctx context.Context, templateRequest *template_manager.TemplateCreateRequest) (*emptypb.Empty, error) {
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

	logsWriter := writer.New(templateRequest.TemplateID, templateRequest.BuildID)
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
		return nil, err
	}

	return nil, nil
}

func (s *serverStore) TemplateDelete(ctx context.Context, in *template_manager.TemplateDeleteRequest) (*emptypb.Empty, error) {
	_, childSpan := s.tracer.Start(ctx, "sandbox-delete")
	defer childSpan.End()

	return nil, nil
}

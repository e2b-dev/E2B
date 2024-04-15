package server

import (
	"context"
	template_manager "github.com/e2b-dev/infra/packages/shared/pkg/grpc/template-manager"
	"go.opentelemetry.io/otel/attribute"
	"google.golang.org/protobuf/types/known/emptypb"
)

const fcVersionsDir = "/fc-versions"
const kernelDir = "/fc-kernels"
const kernelMountDir = "/fc-vm"
const kernelName = "vmlinux.bin"
const uffdBinaryName = "uffd"
const fcBinaryName = "firecracker"

func (s *server) TemplateCreate(ctx context.Context, templateRequest *template_manager.TemplateCreateRequest) (*emptypb.Empty, error) {
	childCtx, childSpan := s.tracer.Start(ctx, "template-create")
	defer childSpan.End()

	childSpan.SetAttributes(
		attribute.String("env.id", templateRequest.TemplateID),
		attribute.String("env.build.id", templateRequest.BuildID),
		attribute.String("env.kernel.version", templateRequest.KernelVersion),
		attribute.String("env.firecracker.version", templateRequest.FirecrackerVersion),
		attribute.String("env.start_cmd", templateRequest.StartCommand),
		attribute.Int64("env.memory_mb", int64(templateRequest.MemoryMB)),
		attribute.Int64("env.vcpu_count", int64(templateRequest.CpuCount)),
	)

	return nil, nil
}

func (s *server) TemplateDelete(ctx context.Context, in *template_manager.TemplateDeleteRequest) (*emptypb.Empty, error) {
	_, childSpan := s.tracer.Start(ctx, "sandbox-delete")
	defer childSpan.End()

	return nil, nil
}

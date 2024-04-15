package server

import (
	"context"
	"fmt"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
	"path/filepath"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const fcVersionsDir = "/fc-versions"
const kernelDir = "/fc-kernels"
const kernelMountDir = "/fc-vm"
const kernelName = "vmlinux.bin"
const uffdBinaryName = "uffd"
const fcBinaryName = "firecracker"

func (s *server) TemplateCreate(ctx context.Context, templateRequest *template) (*orchestrator.NewSandbox, error) {
	childCtx, childSpan := s.tracer.Start(ctx, "sandbox-create")

	defer childSpan.End()
	childSpan.SetAttributes(
		attribute.String("env.id", sandboxRequest.TemplateID),
		attribute.String("env.kernel.version", sandboxRequest.KernelVersion),
		attribute.String("instance.id", sandboxRequest.SandboxID),
		attribute.String("client.id", constants.ClientID),
	)

	sbx, err := sandbox.New(
		childCtx,
		s.tracer,
		s.consul,
		&sandbox.InstanceConfig{
			TemplateID:            sandboxRequest.TemplateID,
			SandboxID:             sandboxRequest.SandboxID,
			TraceID:               childSpan.SpanContext().TraceID().String(),
			TeamID:                sandboxRequest.TeamID,
			KernelVersion:         sandboxRequest.KernelVersion,
			KernelsDir:            kernelDir,
			KernelMountDir:        kernelMountDir,
			KernelName:            kernelName,
			HugePages:             sandboxRequest.HugePages,
			UFFDBinaryPath:        filepath.Join(fcVersionsDir, sandboxRequest.FirecrackerVersion, uffdBinaryName),
			FirecrackerBinaryPath: filepath.Join(fcVersionsDir, sandboxRequest.FirecrackerVersion, fcBinaryName),
		},
		s.dns,
		sandboxRequest,
	)
	if err != nil {
		errMsg := fmt.Errorf("failed to create sandbox: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		return nil, status.New(codes.Internal, errMsg.Error()).Err()
	}

	s.sandboxes.Insert(sandboxRequest.SandboxID, sbx)

	go func() {
		tracer := otel.Tracer("close")
		defer sbx.CleanupAfterFCStop(context.Background(), tracer, s.consul, s.dns)
		defer s.sandboxes.Remove(sandboxRequest.SandboxID)

		err := sbx.FC.Wait()
		if err != nil {
			errMsg := fmt.Errorf("failed to wait for FC: %w", err)
			telemetry.ReportCriticalError(ctx, errMsg)
		}
	}()

	return &orchestrator.NewSandbox{
		SandboxID: sandboxRequest.SandboxID,
		ClientID:  constants.ClientID,
	}, nil
}

func (s *server) SandboxList(ctx context.Context, _ *emptypb.Empty) (*orchestrator.SandboxListResponse, error) {
	_, childSpan := s.tracer.Start(ctx, "sandbox-list")
	defer childSpan.End()

	sandboxes := make([]*orchestrator.SandboxDetail, len(s.sandboxes.Items()))

	for _, sbx := range s.sandboxes.Items() {
		sandboxes = append(sandboxes, sbx.Info)
	}

	return &orchestrator.SandboxListResponse{
		Sandboxes: sandboxes,
	}, nil
}

func (s *server) SandboxDelete(ctx context.Context, in *orchestrator.SandboxRequest) (*emptypb.Empty, error) {
	_, childSpan := s.tracer.Start(ctx, "sandbox-delete")
	defer childSpan.End()

	sbx, ok := s.sandboxes.Get(in.SandboxID)
	if !ok {
		errMsg := fmt.Errorf("sandbox not found")
		telemetry.ReportError(ctx, errMsg)

		return nil, status.New(codes.NotFound, errMsg.Error()).Err()
	}

	err := sbx.FC.Stop(ctx, s.tracer)
	defer sbx.CleanupAfterFCStop(ctx, s.tracer, s.consul, s.dns)
	if err != nil {
		errMsg := fmt.Errorf("failed to stop FC: %w", err)

		telemetry.ReportCriticalError(ctx, errMsg)
		return nil, status.New(codes.Internal, errMsg.Error()).Err()
	}

	return nil, err
}

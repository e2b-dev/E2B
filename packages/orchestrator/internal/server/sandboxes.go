package server

import (
	"context"
	"fmt"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/constants"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/sandbox"
	"github.com/e2b-dev/infra/packages/shared/pkg/grpc/orchestrator"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"go.opentelemetry.io/otel"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"path/filepath"

	"google.golang.org/protobuf/types/known/emptypb"
)

const fcVersionsDir = "/fc-versions"
const kernelDir = "/fc-kernels"
const kernelMountDir = "/fc-vm"
const kernelName = "vmlinux.bin"
const uffdBinaryName = "uffd"
const fcBinaryName = "firecracker"

func (s *server) SandboxCreate(ctx context.Context, sandboxRequest *orchestrator.SandboxCreateRequest) (*orchestrator.NewSandbox, error) {
	tracer := otel.Tracer("create")

	sbx, err := sandbox.New(
		ctx,
		tracer,
		s.consul,
		&sandbox.InstanceConfig{
			TemplateID:            sandboxRequest.TemplateID,
			SandboxID:             sandboxRequest.SandboxID,
			TraceID:               sandboxRequest.TraceID,
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

func (s *server) SandboxesList(ctx context.Context, _ *emptypb.Empty) (*orchestrator.SandboxListResponse, error) {
	// TODO:
	tracer := otel.Tracer("list")
	_, childSpan := tracer.Start(ctx, "list")
	defer childSpan.End()

	sandboxes := make([]*orchestrator.SandboxDetail, len(s.sandboxes.Items()))

	for _, sbx := range s.sandboxes.Items() {
		sandboxes = append(sandboxes, sbx.Info)
	}

	return &orchestrator.SandboxListResponse{
		Sandboxes: sandboxes,
	}, nil
}

func (s *server) SandboxesDelete(ctx context.Context, in *orchestrator.SandboxRequest) (*emptypb.Empty, error) {
	tracer := otel.Tracer("delete")

	sbx, ok := s.sandboxes.Get(in.SandboxID)
	if !ok {
		errMsg := fmt.Errorf("sandbox not found")
		telemetry.ReportError(ctx, errMsg)

		return nil, status.New(codes.NotFound, errMsg.Error()).Err()
	}

	err := sbx.FC.Stop(ctx, tracer)
	defer sbx.CleanupAfterFCStop(ctx, tracer, s.consul, s.dns)
	if err != nil {
		errMsg := fmt.Errorf("failed to stop FC: %w", err)

		telemetry.ReportCriticalError(ctx, errMsg)
		return nil, status.New(codes.Internal, errMsg.Error()).Err()
	}

	return nil, err
}

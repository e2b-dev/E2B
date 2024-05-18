package process

import (
	"context"
	"errors"
	"net/http"

	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process/v1"
	specconnect "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process/v1/processv1connect"

	"connectrpc.com/connect"
)

type Service struct {
	specconnect.UnimplementedProcessServiceHandler
}

func Handle(server *http.ServeMux, opts ...connect.HandlerOption) {
	path, handler := specconnect.NewProcessServiceHandler(&Service{}, opts...)

	server.Handle(path, handler)
}

func (s *Service) StartProcess(ctx context.Context, req *connect.Request[v1.StartProcessRequest], stream *connect.ServerStream[v1.StartProcessResponse]) error {
	process, err := new(req.Msg)
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}
}

func (s *Service) ListProcesses(ctx context.Context, req *connect.Request[v1.ListProcessesRequest]) (*connect.Response[v1.ListProcessesResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("envd.process.v1.ProcessService.ListProcesses is not implemented"))
}

func (s *Service) ReconnectProcess(ctx context.Context, req *connect.Request[v1.ReconnectProcessRequest], stream *connect.ServerStream[v1.ReconnectProcessResponse]) error {
	return connect.NewError(connect.CodeUnimplemented, errors.New("envd.process.v1.ProcessService.ReconnectProcess is not implemented"))
}

func (s *Service) UpdateProcess(ctx context.Context, req *connect.Request[v1.UpdateProcessRequest]) (*connect.Response[v1.UpdateProcessResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("envd.process.v1.ProcessService.UpdateProcess is not implemented"))
}

func (s *Service) SendProcessInput(ctx context.Context, req *connect.Request[v1.SendProcessInputRequest]) (*connect.Response[v1.SendProcessInputResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("envd.process.v1.ProcessService.SendProcessInput is not implemented"))
}

func (s *Service) SendProcessSignal(ctx context.Context, req *connect.Request[v1.SendProcessSignalRequest]) (*connect.Response[v1.SendProcessSignalResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("envd.process.v1.ProcessService.SendProcessSignal is not implemented"))
}

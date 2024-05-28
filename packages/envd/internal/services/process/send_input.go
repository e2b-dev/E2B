package process

import (
	"context"
	"errors"
	"fmt"

	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process/v1"

	"connectrpc.com/connect"
)

func handleInput(process *process, in *v1.ProcessInput) error {
	switch in.GetInput().(type) {
	case *v1.ProcessInput_Tty:
		err := process.WriteTty(in.GetTty())
		if err != nil {
			return connect.NewError(connect.CodeInternal, fmt.Errorf("error writing to tty: %w", err))
		}
	case *v1.ProcessInput_Stdin:
		err := process.WriteStdin(in.GetStdin())
		if err != nil {
			return connect.NewError(connect.CodeInternal, fmt.Errorf("error writing to stdin: %w", err))
		}
	default:
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid input type %T", in.Input))
	}

	return nil
}

func (s *Service) SendProcessInput(ctx context.Context, req *connect.Request[v1.SendProcessInputRequest]) (*connect.Response[v1.SendProcessInputResponse], error) {
	process, ok := s.processes.Load(req.Msg.GetProcess().GetPid())
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with pid %d not found", req.Msg.GetProcess().GetPid()))
	}

	err := handleInput(process, req.Msg.GetInput())
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&v1.SendProcessInputResponse{}), nil
}

func (s *Service) SendProcessInputStream(ctx context.Context, stream *connect.ClientStream[v1.SendProcessInputStreamRequest]) (*connect.Response[v1.SendProcessInputResponse], error) {
	var process *process

	for stream.Receive() {
		req := stream.Msg()

		switch req.GetEvent().(type) {
		case *v1.SendProcessInputStreamRequest_Start:
			p, ok := s.processes.Load(req.GetStart().GetProcess().GetPid())
			if !ok {
				return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with pid %d not found", req.GetStart().GetProcess().GetPid()))
			}
			process = p

		case *v1.SendProcessInputStreamRequest_Data:
			err := handleInput(process, req.GetData().GetInput())
			if err != nil {
				return nil, err
			}
		}
	}

	err := stream.Err()
	if err != nil {
		return nil, connect.NewError(connect.CodeUnknown, err)
	}

	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("envd.process.v1.ProcessService.SendProcessInputStream is not implemented"))
}

package process

import (
	"context"
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

func (s *Service) SendInput(ctx context.Context, req *connect.Request[v1.SendInputRequest]) (*connect.Response[v1.SendInputResponse], error) {
	process, ok := s.processes.Load(req.Msg.GetProcess().GetPid())
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with pid %d not found", req.Msg.GetProcess().GetPid()))
	}

	err := handleInput(process, req.Msg.GetInput())
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&v1.SendInputResponse{}), nil
}

func (s *Service) StreamInput(ctx context.Context, stream *connect.ClientStream[v1.StreamInputRequest]) (*connect.Response[v1.StreamInputResponse], error) {
	var process *process

	for stream.Receive() {
		req := stream.Msg()

		switch req.GetEvent().(type) {
		case *v1.StreamInputRequest_Start:
			p, ok := s.processes.Load(req.GetStart().GetProcess().GetPid())
			if !ok {
				return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with pid %d not found", req.GetStart().GetProcess().GetPid()))
			}
			process = p

		case *v1.StreamInputRequest_Data:
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

	return connect.NewResponse(&v1.StreamInputResponse{}), nil
}

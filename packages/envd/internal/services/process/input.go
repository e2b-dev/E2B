package process

import (
	"context"
	"fmt"

	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"connectrpc.com/connect"
)

func handleInput(process *process, in *rpc.ProcessInput) error {
	switch in.GetInput().(type) {
	case *rpc.ProcessInput_Pty:
		err := process.WriteTty(in.GetPty())
		if err != nil {
			return connect.NewError(connect.CodeInternal, fmt.Errorf("error writing to tty: %w", err))
		}
	case *rpc.ProcessInput_Stdin:
		err := process.WriteStdin(in.GetStdin())
		if err != nil {
			return connect.NewError(connect.CodeInternal, fmt.Errorf("error writing to stdin: %w", err))
		}
	default:
		return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid input type %T", in.Input))
	}

	return nil
}

func (s *Service) SendInput(ctx context.Context, req *connect.Request[rpc.SendInputRequest]) (*connect.Response[rpc.SendInputResponse], error) {
	process, ok := s.processes.Load(req.Msg.GetProcess().GetPid())
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with pid %d not found", req.Msg.GetProcess().GetPid()))
	}

	err := handleInput(process, req.Msg.GetInput())
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&rpc.SendInputResponse{}), nil
}

func (s *Service) StreamInput(ctx context.Context, stream *connect.ClientStream[rpc.StreamInputRequest]) (*connect.Response[rpc.StreamInputResponse], error) {
	var process *process

	for stream.Receive() {
		req := stream.Msg()

		switch req.GetEvent().(type) {
		case *rpc.StreamInputRequest_Start:
			p, ok := s.processes.Load(req.GetStart().GetProcess().GetPid())
			if !ok {
				return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with pid %d not found", req.GetStart().GetProcess().GetPid()))
			}
			process = p

		case *rpc.StreamInputRequest_Data:
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

	return connect.NewResponse(&rpc.StreamInputResponse{}), nil
}

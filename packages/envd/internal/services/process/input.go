package process

import (
	"context"
	"fmt"

	"github.com/e2b-dev/infra/packages/envd/internal/services/process/handler"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"connectrpc.com/connect"
)

func handleInput(process *handler.Handler, in *rpc.ProcessInput) error {
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
	proc, err := s.getProcess(req.Msg.GetProcess())
	if err != nil {
		return nil, err
	}

	err = handleInput(proc, req.Msg.GetInput())
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&rpc.SendInputResponse{}), nil
}

func (s *Service) StreamInput(ctx context.Context, stream *connect.ClientStream[rpc.StreamInputRequest]) (*connect.Response[rpc.StreamInputResponse], error) {
	var proc *handler.Handler

	for stream.Receive() {
		req := stream.Msg()

		switch req.GetEvent().(type) {
		case *rpc.StreamInputRequest_Start:
			p, err := s.getProcess(req.GetStart().GetProcess())
			if err != nil {
				return nil, err
			}

			proc = p
		case *rpc.StreamInputRequest_Data:
			err := handleInput(proc, req.GetData().GetInput())
			if err != nil {
				return nil, err
			}
		default:
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid event type %T", req.Event))
		}
	}

	err := stream.Err()
	if err != nil {
		return nil, connect.NewError(connect.CodeUnknown, err)
	}

	return connect.NewResponse(&rpc.StreamInputResponse{}), nil
}

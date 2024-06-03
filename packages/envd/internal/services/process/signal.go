package process

import (
	"context"
	"fmt"
	"syscall"

	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"connectrpc.com/connect"
)

func (s *Service) SendSignal(ctx context.Context, req *connect.Request[rpc.SendSignalRequest]) (*connect.Response[rpc.SendSignalResponse], error) {
	process, ok := s.processes.Load(req.Msg.GetProcess().GetPid())
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with pid %d not found", req.Msg.GetProcess().GetPid()))
	}

	var signal syscall.Signal
	switch req.Msg.GetSignal() {
	case *rpc.Signal_SIGNAL_SIGKILL.Enum():
		signal = syscall.SIGKILL
	case *rpc.Signal_SIGNAL_SIGTERM.Enum():
		signal = syscall.SIGTERM
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid signal: %s", req.Msg.GetSignal()))
	}

	err := process.SendSignal(signal)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error sending signal: %w", err))
	}

	return connect.NewResponse(&rpc.SendSignalResponse{}), nil
}

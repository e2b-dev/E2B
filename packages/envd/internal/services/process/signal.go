package process

import (
	"context"
	"fmt"
	"syscall"

	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/process"

	"connectrpc.com/connect"
)

func (s *Service) SendSignal(ctx context.Context, req *connect.Request[rpc.SendSignalRequest]) (*connect.Response[rpc.SendSignalResponse], error) {
	proc, err := s.getProcess(req.Msg.Process)
	if err != nil {
		return nil, err
	}

	var signal syscall.Signal
	switch req.Msg.GetSignal() {
	case rpc.Signal_SIGNAL_SIGKILL:
		signal = syscall.SIGKILL
	case rpc.Signal_SIGNAL_SIGTERM:
		signal = syscall.SIGTERM
	default:
		return nil, connect.NewError(connect.CodeUnimplemented, fmt.Errorf("invalid signal: %s", req.Msg.GetSignal()))
	}

	err = proc.SendSignal(signal)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error sending signal: %w", err))
	}

	return connect.NewResponse(&rpc.SendSignalResponse{}), nil
}

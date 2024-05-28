package process

import (
	"context"
	"fmt"

	"github.com/creack/pty"
	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process/v1"

	"connectrpc.com/connect"
)

func (s *Service) UpdateProcess(ctx context.Context, req *connect.Request[v1.UpdateProcessRequest]) (*connect.Response[v1.UpdateProcessResponse], error) {
	process, ok := s.processes.Load(req.Msg.GetProcess().GetPid())
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with pid %d not found", req.Msg.GetProcess().GetPid()))
	}

	if req.Msg.GetPty() != nil {
		err := process.ResizeTty(&pty.Winsize{
			Rows: uint16(req.Msg.GetPty().GetSize().GetRows()),
			Cols: uint16(req.Msg.GetPty().GetSize().GetCols()),
		})
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error resizing tty: %w", err))
		}
	}

	return connect.NewResponse(&v1.UpdateProcessResponse{}), nil
}

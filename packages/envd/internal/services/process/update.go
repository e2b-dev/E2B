package process

import (
	"context"
	"fmt"

	"github.com/creack/pty"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"connectrpc.com/connect"
)

func (s *Service) Update(ctx context.Context, req *connect.Request[rpc.UpdateRequest]) (*connect.Response[rpc.UpdateResponse], error) {
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

	return connect.NewResponse(&rpc.UpdateResponse{}), nil
}

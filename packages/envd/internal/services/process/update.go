package process

import (
	"context"
	"fmt"

	"github.com/creack/pty"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"connectrpc.com/connect"
)

func (s *Service) Update(ctx context.Context, req *connect.Request[rpc.UpdateRequest]) (*connect.Response[rpc.UpdateResponse], error) {
	proc, err := s.getProcess(req.Msg.Process)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	if req.Msg.GetPty() != nil {
		err := proc.ResizeTty(&pty.Winsize{
			Rows: uint16(req.Msg.GetPty().GetSize().GetRows()),
			Cols: uint16(req.Msg.GetPty().GetSize().GetCols()),
		})
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error resizing tty: %w", err))
		}
	}

	return connect.NewResponse(&rpc.UpdateResponse{}), nil
}

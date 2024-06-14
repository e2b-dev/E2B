package process

import (
	"context"

	"github.com/e2b-dev/infra/packages/envd/internal/services/process/handler"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/process"

	"connectrpc.com/connect"
)

func (s *Service) List(ctx context.Context, req *connect.Request[rpc.ListRequest]) (*connect.Response[rpc.ListResponse], error) {
	processes := make([]*rpc.ProcessInfo, 0)

	s.processes.Range(func(pid uint32, value *handler.Handler) bool {
		processes = append(processes, &rpc.ProcessInfo{
			Pid:    pid,
			Tag:    value.Tag,
			Config: value.Config,
		})

		return true
	})

	return connect.NewResponse(&rpc.ListResponse{
		Processes: processes,
	}), nil
}

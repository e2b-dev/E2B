package process

import (
	"context"

	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"connectrpc.com/connect"
)

func (s *Service) List(ctx context.Context, req *connect.Request[rpc.ListRequest]) (*connect.Response[rpc.ListResponse], error) {
	processes := make([]*rpc.ProcessConfig, 0)

	s.processes.Range(func(_ uint32, value *process) bool {
		processes = append(processes, value.config)
		return true
	})

	return &connect.Response[rpc.ListResponse]{
		Msg: &rpc.ListResponse{
			Processes: processes,
		},
	}, nil
}

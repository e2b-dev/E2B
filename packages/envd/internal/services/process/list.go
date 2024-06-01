package process

import (
	"context"

	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process/v1"

	"connectrpc.com/connect"
)

func (s *Service) List(ctx context.Context, req *connect.Request[v1.ListRequest]) (*connect.Response[v1.ListResponse], error) {
	processes := make([]*v1.ProcessConfig, 0)

	s.processes.Range(func(_ uint32, value *process) bool {
		processes = append(processes, value.config)
		return true
	})

	return &connect.Response[v1.ListResponse]{
		Msg: &v1.ListResponse{
			Processes: processes,
		},
	}, nil
}

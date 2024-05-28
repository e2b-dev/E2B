package process

import (
	"context"

	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process/v1"

	"connectrpc.com/connect"
)

func (s *Service) ListProcesses(ctx context.Context, req *connect.Request[v1.ListProcessesRequest]) (*connect.Response[v1.ListProcessesResponse], error) {
	processes := make([]*v1.ProcessConfig, 0)

	s.processes.Range(func(_ uint32, value *process) bool {
		processes = append(processes, value.config)
		return true
	})

	return &connect.Response[v1.ListProcessesResponse]{
		Msg: &v1.ListProcessesResponse{
			Processes: processes,
		},
	}, nil
}

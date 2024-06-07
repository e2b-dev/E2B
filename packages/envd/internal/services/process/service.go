package process

import (
	"fmt"
	"net/http"

	"github.com/e2b-dev/infra/packages/envd/internal/services/process/handler"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/process"
	spec "github.com/e2b-dev/infra/packages/envd/internal/services/spec/process/processconnect"

	"connectrpc.com/connect"
	"github.com/rs/zerolog"
)

type Service struct {
	spec.UnimplementedProcessHandler
	processes *Map[uint32, *handler.Handler]
	logger    *zerolog.Logger
}

func newService(l *zerolog.Logger) *Service {
	return &Service{
		logger:    l,
		processes: newMap[uint32, *handler.Handler](),
	}
}

func Handle(server *http.ServeMux, l *zerolog.Logger, opts ...connect.HandlerOption) *Service {
	service := newService(l)

	path, handler := spec.NewProcessHandler(service, opts...)

	server.Handle(path, handler)

	return service
}

func (s *Service) getProcess(selector *rpc.ProcessSelector) (*handler.Handler, error) {
	var proc *handler.Handler

	switch selector.GetSelector().(type) {
	case *rpc.ProcessSelector_Pid:
		p, ok := s.processes.Load(selector.GetPid())
		if !ok {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with pid %d not found", selector.GetPid()))
		}

		proc = p
	case *rpc.ProcessSelector_Tag:
		tag := selector.GetTag()

		s.processes.Range(func(_ uint32, value *handler.Handler) bool {
			if value.Tag == nil {
				return true
			}

			if *value.Tag == tag {
				proc = value
				return true
			}

			return false
		})

		if proc == nil {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with tag %s not found", tag))
		}

	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid input type %T", selector))
	}

	return proc, nil
}

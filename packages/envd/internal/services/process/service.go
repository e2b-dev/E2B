package process

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"syscall"

	"github.com/creack/pty"
	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process/v1"
	specconnect "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process/v1/processv1connect"

	"connectrpc.com/connect"
)

const defaultChunkSize = 32 * 1024 // 32KB

type Service struct {
	specconnect.UnimplementedProcessServiceHandler
	processes *Map[uint32, *process]
}

func newService() *Service {
	return &Service{
		processes: newMap[uint32, *process](),
	}
}

func Handle(server *http.ServeMux, opts ...connect.HandlerOption) {
	service := newService()

	path, handler := specconnect.NewProcessServiceHandler(service, opts...)

	server.Handle(path, handler)
}

func (s *Service) StartProcess(ctx context.Context, req *connect.Request[v1.StartProcessRequest], stream *connect.ServerStream[v1.StartProcessResponse]) error {
	process, err := newProcess(req.Msg)
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}

	// Ensure the first header or message contains pid
	// Wait with the first content message for the pid initial message
	var streamMu sync.Mutex
	streamMu.Lock()

	startChan := make(chan uint32)
	go func() {
		select {
		case <-ctx.Done():
			streamMu.Unlock()
		case pid := <-startChan:
			err = stream.Send(&v1.StartProcessResponse{
				Event: &v1.ProcessEvent{
					EventType: &v1.ProcessEvent_Start{
						Start: &v1.ProcessEvent_StartEvent{
							Pid: uint32(pid),
						},
					},
				},
			})
			if err != nil {
				log.Println(err)
			}

			streamMu.Unlock()
		}
	}()

	stdoutWriter, stdoutReader := io.Pipe()
	process.stdout.Add(stdoutReader)
	go func() {
		defer process.stdout.Remove(stdoutReader)
		defer stdoutWriter.Close()

		_, err := io.Copy(stdoutWriter, stdoutReader)
		if err != nil {
			log.Println(err)
		}
	}()

	stderrWriter, stderrReader := io.Pipe()
	process.stderr.Add(stderrReader)
	go func() {
		defer process.stderr.Remove(stderrReader)
		defer stderrWriter.Close()
	}()

	// All process handling independant to the stream should be in this goroutine
	go func() {
		pid, err := process.Start()
		if err != nil {
			log.Println(err)

			// TODO: Send the error as exit
			return
		}

		s.processes.Store(pid, process)
		defer s.processes.Delete(pid)

		startChan <- pid
		close(startChan)

		exit, err := process.Wait()
		if err != nil {
			log.Println(err)

			// TODO: Send the error as exit
			return
		}
	}()

	return nil
}

func (s *Service) ReconnectProcess(ctx context.Context, req *connect.Request[v1.ReconnectProcessRequest], stream *connect.ServerStream[v1.ReconnectProcessResponse]) error {
	return connect.NewError(connect.CodeUnimplemented, errors.New("envd.process.v1.ProcessService.ReconnectProcess is not implemented"))
}

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

func (s *Service) SendProcessInput(ctx context.Context, req *connect.Request[v1.SendProcessInputRequest]) (*connect.Response[v1.SendProcessInputResponse], error) {
	process, ok := s.processes.Load(req.Msg.GetProcess().GetPid())
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with pid %d not found", req.Msg.GetProcess().GetPid()))
	}

	switch req.Msg.GetInput().Input.(type) {
	case *v1.ProcessInput_Tty:
		err := process.WriteTty(req.Msg.GetInput().GetTty())
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error writing to tty: %w", err))
		}
	case *v1.ProcessInput_Stdin:
		err := process.WriteStdin(req.Msg.GetInput().GetStdin())
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error writing to stdin: %w", err))
		}
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid input type %T", req.Msg.GetInput()))
	}

	return connect.NewResponse(&v1.SendProcessInputResponse{}), nil
}

func (s *Service) SendProcessSignal(ctx context.Context, req *connect.Request[v1.SendProcessSignalRequest]) (*connect.Response[v1.SendProcessSignalResponse], error) {
	process, ok := s.processes.Load(req.Msg.GetProcess().GetPid())
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with pid %d not found", req.Msg.GetProcess().GetPid()))
	}

	var signal syscall.Signal
	switch req.Msg.GetSignal() {
	case *v1.Signal_SIGNAL_SIGKILL.Enum():
		signal = syscall.SIGKILL
	case *v1.Signal_SIGNAL_SIGTERM.Enum():
		signal = syscall.SIGTERM
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid signal: %s", req.Msg.GetSignal()))
	}

	err := process.SendSignal(signal)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error sending signal: %w", err))
	}

	return connect.NewResponse(&v1.SendProcessSignalResponse{}), nil
}

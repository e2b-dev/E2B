package process

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"

	"github.com/e2b-dev/infra/packages/envd/internal/host"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"
	spec "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process/processconnect"

	"connectrpc.com/connect"
)

const defaultChunkSize = 32 * 1024 // 32KB

type Service struct {
	spec.UnimplementedProcessServiceHandler
	processes *Map[uint32, *process]
}

func newService() *Service {
	return &Service{
		processes: newMap[uint32, *process](),
	}
}

func Handle(server *http.ServeMux, opts ...connect.HandlerOption) {
	service := newService()

	path, handler := spec.NewProcessServiceHandler(service, opts...)

	server.Handle(path, handler)
}

func (s *Service) getProcess(selector *rpc.ProcessSelector) (*process, error) {
	switch selector.GetSelector().(type) {
	case *rpc.ProcessSelector_Pid:
		proc, ok := s.processes.Load(selector.GetPid())
		if !ok {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with pid %d not found", selector.GetPid()))
		}

		return proc, nil
	case *rpc.ProcessSelector_Tag:
		tag := selector.GetTag()
		var proc *process

		s.processes.Range(func(key uint32, value *process) bool {
			if value.tag == nil {
				return true
			}

			if *value.tag == tag {
				proc = value
				return true
			}

			return false
		})

		if proc == nil {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("process with tag %s not found", tag))
		}

		return proc, nil
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid input type %T", selector))
	}
}

func (s *Service) Start(ctx context.Context, req *connect.Request[rpc.StartRequest], stream *connect.ServerStream[rpc.StartResponse]) error {
	host.WaitForHostSync()

	proc, err := newProcess(req.Msg, req.Msg.Tag)
	if err != nil {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}

	// Ensure the first header or message contains pid
	// Wait with the first content message for the pid initial message
	var streamMu sync.Mutex
	streamMu.Lock()

	startChan := make(chan uint32)

	go func() {
		defer wg.Done()
		select {
		case <-ctx.Done():
			streamMu.Unlock()
		case pid := <-startChan:
			err = stream.Send(&rpc.StartResponse{
				Event: &rpc.ProcessEvent{
					EventType: &rpc.ProcessEvent_Start{
						Start: &rpc.ProcessEvent_StartEvent{
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
	var wg sync.WaitGroup

	stdoutWriter, stdoutReader := io.Pipe()
	proc.stdout.Add(stdoutReader)

	wg.Add(1)
	go func() {
		defer proc.stdout.Remove(stdoutReader)
		defer stdoutWriter.Close()

		_, err := io.Copy(stdoutReader, stdoutWriter)
		if err != nil {
			log.Println(err)
		}
	}()

	stderrWriter, stderrReader := io.Pipe()
	proc.stderr.Add(stderrReader)

	wg.Add(1)
	go func() {
		defer proc.stderr.Remove(stderrReader)
		defer stderrWriter.Close()

		_, err := io.Copy(stderrReader, stderrWriter)
		if err != nil {
			log.Println(err)
		}
	}()

	exitCh := make(chan processExit)

	// All process handling independant to the stream should be in this goroutine
	go func() {
		pid, err := proc.Start()
		if err != nil {
			log.Println(err)

			// TODO: Send the error as exit
			return
		}

		s.processes.Store(pid, proc)
		defer s.processes.Delete(pid)

		startChan <- pid
		close(startChan)

		exit, err := proc.Wait()
		if err != nil {
			log.Println(err)

			// TODO: Send the error as exit
			return
		}
	}()

	wg.Wait()

	select {
	case <-ctx.Done():
		log.Println("context done")
	case exit := <-exitCh:
		log.Println(exit)
	}

	return nil
}

func (s *Service) Connect(ctx context.Context, req *connect.Request[rpc.ConnectRequest], stream *connect.ServerStream[rpc.ConnectResponse]) error {
	proc, err := s.getProcess(req.Msg.GetProcess())
	if err != nil {
		return connect.NewError(connect.CodeNotFound, err)
	}

	stdoutWriter, stdoutReader := io.Pipe()
	proc.stdout.Add(stdoutReader)
	go func() {
		defer proc.stdout.Remove(stdoutReader)
		defer stdoutWriter.Close()

		_, err := io.Copy(stdoutReader, stdoutWriter)
		if err != nil {
			log.Println(err)
		}
	}()

	stderrWriter, stderrReader := io.Pipe()
	proc.stderr.Add(stderrReader)
	go func() {
		defer proc.stderr.Remove(stderrReader)
		defer stderrWriter.Close()

		_, err := io.Copy(stderrReader, stderrWriter)
		if err != nil {
			log.Println(err)
		}
	}()

	// TODO: add tty reader too

	return nil
}

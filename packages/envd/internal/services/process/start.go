package process

import (
	"context"
	"fmt"
	"os"
	"sync"

	"github.com/e2b-dev/infra/packages/envd/internal/host"
	"github.com/e2b-dev/infra/packages/envd/internal/services/process/handler"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"connectrpc.com/connect"
)

func (s *Service) StartBackgroundProcess(ctx context.Context, req *rpc.StartRequest) error {
	proc, err := handler.New(req)
	if err != nil {
		return err
	}

	pid, err := proc.Start()
	if err != nil {
		return err
	}

	s.processes.Store(pid, proc)
	defer s.processes.Delete(pid)

	go func() {
		defer s.processes.Delete(pid)

		proc.Wait()
	}()

	return nil
}

func (s *Service) Start(ctx context.Context, req *connect.Request[rpc.StartRequest], stream *connect.ServerStream[rpc.StartResponse]) error {
	host.WaitForHostSync()

	proc, err := handler.New(req.Msg)
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}

	subscribeExit := make(chan struct{})
	defer close(subscribeExit)

	var streamMu sync.Mutex
	streamMu.Lock()

	go func() {
		defer close(subscribeExit)

		subscribeToProcessData(ctx, proc, func(data *rpc.ProcessEvent_Data) {
			streamMu.Lock()
			defer streamMu.Unlock()

			err := stream.Send(&rpc.StartResponse{
				Event: &rpc.ProcessEvent{
					Event: data,
				},
			})
			if err != nil {
				fmt.Fprintf(os.Stderr, "failed to send process event: %v\n", err)
			}
		})
	}()

	pid, err := proc.Start()
	if err != nil {
		return connect.NewError(connect.CodeInternal, err)
	}

	s.processes.Store(pid, proc)

	exitChan := proc.Exit.Subscribe()
	defer proc.Exit.Unsubscribe(exitChan)

	go func() {
		defer s.processes.Delete(pid)

		proc.Wait()
	}()

	streamErr := stream.Send(&rpc.StartResponse{
		Event: &rpc.ProcessEvent{
			Event: &rpc.ProcessEvent_Start{
				Start: &rpc.ProcessEvent_StartEvent{
					Pid: pid,
				},
			},
		},
	})
	if streamErr != nil {
		return connect.NewError(connect.CodeInternal, streamErr)
	}

	select {
	case <-ctx.Done():
		return connect.NewError(connect.CodeCanceled, ctx.Err())
	case exitInfo := <-exitChan:
		<-subscribeExit

		exitErr := exitInfo.Err.Error()

		streamErr = stream.Send(&rpc.StartResponse{
			Event: &rpc.ProcessEvent{
				Event: &rpc.ProcessEvent_End{
					End: &rpc.ProcessEvent_EndEvent{
						ExitCode:   exitInfo.Code,
						Terminated: exitInfo.Terminated,
						Error:      &exitErr,
						Status:     exitInfo.Status,
					},
				},
			},
		})
		if streamErr != nil {
			return connect.NewError(connect.CodeInternal, streamErr)
		}
	}

	return nil
}

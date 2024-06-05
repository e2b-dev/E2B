package process

import (
	"context"
	"fmt"
	"os"

	"github.com/e2b-dev/infra/packages/envd/internal/host"
	"github.com/e2b-dev/infra/packages/envd/internal/services/process/handler"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"connectrpc.com/connect"
	"golang.org/x/sync/semaphore"
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

	streamSemaphore := semaphore.NewWeighted(1)

	semErr := streamSemaphore.Acquire(ctx, 1)
	if semErr != nil {
		return connect.NewError(connect.CodeInternal, semErr)
	}

	go func() {
		defer close(subscribeExit)

		subscribeToProcessData(ctx, proc, func(data *rpc.ProcessEvent_DataEvent) {
			processSemErr := streamSemaphore.Acquire(ctx, 1)
			if processSemErr != nil {
				fmt.Fprintf(os.Stderr, "failed to acquire stream semaphore: %v\n", processSemErr)
				return
			}
			defer streamSemaphore.Release(1)

			streamErr := stream.Send(&rpc.StartResponse{
				Event: &rpc.ProcessEvent{
					Event: &rpc.ProcessEvent_Data{
						Data: data,
					},
				},
			})
			if streamErr != nil {
				fmt.Fprintf(os.Stderr, "failed to send process event: %v\n", streamErr)
				return
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

	streamSemaphore.Release(1)

	if streamErr != nil {
		return connect.NewError(connect.CodeInternal, streamErr)
	}

	select {
	case <-ctx.Done():
		return connect.NewError(connect.CodeCanceled, ctx.Err())
	case exitInfo := <-exitChan:
		<-subscribeExit

		exitErr := exitInfo.Err.Error()

		endSemErr := streamSemaphore.Acquire(ctx, 1)
		if endSemErr != nil {
			fmt.Fprintf(os.Stderr, "failed to acquire stream semaphore: %v\n", endSemErr)
			return connect.NewError(connect.CodeInternal, endSemErr)
		}

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

		streamSemaphore.Release(1)

		if streamErr != nil {
			return connect.NewError(connect.CodeInternal, streamErr)
		}
	}

	return nil
}

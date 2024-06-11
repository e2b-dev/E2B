package process

import (
	"context"

	"github.com/e2b-dev/infra/packages/envd/internal/host"
	"github.com/e2b-dev/infra/packages/envd/internal/logs"
	"github.com/e2b-dev/infra/packages/envd/internal/services/process/handler"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/process"

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
	return logs.LogServerStreamWithoutEvents(ctx, s.logger, req, stream, s.handleStart)
}

func (s *Service) handleStart(ctx context.Context, req *connect.Request[rpc.StartRequest], stream *connect.ServerStream[rpc.StartResponse]) error {
	ctx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)

	s.logger.Trace().Msg("waiting for clock to sync")
	host.WaitForSync()
	s.logger.Trace().Msg("clock synced")

	proc, err := handler.New(req.Msg)
	if err != nil {
		return err
	}

	streamSemaphore := semaphore.NewWeighted(1)

	semErr := streamSemaphore.Acquire(ctx, 1)
	if semErr != nil {
		return connect.NewError(connect.CodeAborted, semErr)
	}

	subscribeExit := make(chan struct{})

	go func() {
		defer close(subscribeExit)

		subscribeToProcessData(ctx, cancel, proc, func(data *rpc.ProcessEvent_DataEvent) {
			processSemErr := streamSemaphore.Acquire(ctx, 1)
			if processSemErr != nil {
				cancel(connect.NewError(connect.CodeAborted, processSemErr))

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
				cancel(connect.NewError(connect.CodeUnknown, streamErr))

				return
			}
		})
	}()

	pid, err := proc.Start()
	if err != nil {
		return connect.NewError(connect.CodeUnknown, err)
	}

	s.processes.Store(pid, proc)

	exitChan, unsubscribe := proc.Exit.Subscribe()
	defer unsubscribe()

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
		return connect.NewError(connect.CodeUnknown, streamErr)
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	case exitInfo := <-exitChan:
		<-subscribeExit

		endSemErr := streamSemaphore.Acquire(ctx, 1)
		if endSemErr != nil {
			return connect.NewError(connect.CodeAborted, endSemErr)
		}

		event := &rpc.ProcessEvent{
			Event: &rpc.ProcessEvent_End{
				End: &rpc.ProcessEvent_EndEvent{
					ExitCode: exitInfo.Code,
					Exited:   exitInfo.Exited,
					Error:    exitInfo.Error,
					Status:   exitInfo.Status,
				},
			},
		}

		streamErr = stream.Send(&rpc.StartResponse{
			Event: event,
		})

		logs.LogStreamEvent(ctx, s.logger.Debug(), req.Spec().Procedure, event)

		streamSemaphore.Release(1)

		if streamErr != nil {
			return connect.NewError(connect.CodeUnknown, streamErr)
		}
	}

	return nil
}

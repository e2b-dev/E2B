package process

import (
	"context"
	"errors"

	"github.com/e2b-dev/infra/packages/envd/internal/host"
	"github.com/e2b-dev/infra/packages/envd/internal/logs"
	"github.com/e2b-dev/infra/packages/envd/internal/services/process/handler"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/process"

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

	exitChan := make(chan struct{})

	startMultiplexer := handler.NewMultiplexedChannel[rpc.ProcessEvent_Start](0)
	defer close(startMultiplexer.Source)

	start, startCancel := startMultiplexer.Fork()
	defer startCancel()

	data, dataCancel := proc.DataEvent.Fork()
	defer dataCancel()

	end, endCancel := proc.EndEvent.Fork()
	defer endCancel()

	go func() {
		defer close(exitChan)

		select {
		case <-ctx.Done():
			cancel(ctx.Err())

			return
		case event, ok := <-start:
			if !ok {
				cancel(connect.NewError(connect.CodeUnknown, errors.New("start event channel closed before sending start event")))

				return
			}

			stream.Send(&rpc.StartResponse{
				Event: &rpc.ProcessEvent{
					Event: &event,
				},
			})
			if err != nil {
				cancel(connect.NewError(connect.CodeUnknown, err))

				return
			}
		}

	dataLoop:
		for {
			select {
			case <-ctx.Done():
				cancel(ctx.Err())
				return
			case event, ok := <-data:
				if !ok {
					break dataLoop
				}

				err := stream.Send(&rpc.StartResponse{
					Event: &rpc.ProcessEvent{
						Event: &event,
					},
				})
				if err != nil {
					cancel(connect.NewError(connect.CodeUnknown, err))
					return
				}
			}
		}

		select {
		case <-ctx.Done():
			cancel(ctx.Err())

			return
		case event, ok := <-end:
			if !ok {
				cancel(connect.NewError(connect.CodeUnknown, errors.New("end event channel closed before sending end event")))

				return
			}

			err := stream.Send(&rpc.StartResponse{
				Event: &rpc.ProcessEvent{
					Event: &event,
				},
			})
			if err != nil {
				cancel(connect.NewError(connect.CodeUnknown, err))

				return
			}
		}
	}()

	pid, err := proc.Start()
	if err != nil {
		return connect.NewError(connect.CodeUnknown, err)
	}

	s.processes.Store(pid, proc)

	start <- rpc.ProcessEvent_Start{
		Start: &rpc.ProcessEvent_StartEvent{
			Pid: pid,
		},
	}

	go func() {
		defer s.processes.Delete(pid)

		proc.Wait()
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-exitChan:
		return nil
	}
}

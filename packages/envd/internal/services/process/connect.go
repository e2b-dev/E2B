package process

import (
	"context"

	"github.com/e2b-dev/infra/packages/envd/internal/logs"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/process"

	"connectrpc.com/connect"
)

func (s *Service) Connect(ctx context.Context, req *connect.Request[rpc.ConnectRequest], stream *connect.ServerStream[rpc.ConnectResponse]) error {
	return logs.LogServerStreamWithoutEvents(ctx, s.logger, req, stream, s.handleConnect)
}

func (s *Service) handleConnect(ctx context.Context, req *connect.Request[rpc.ConnectRequest], stream *connect.ServerStream[rpc.ConnectResponse]) error {
	ctx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)

	proc, err := s.getProcess(req.Msg.GetProcess())
	if err != nil {
		return err
	}

	exitChan := make(chan struct{})

	data, dataCancel := proc.OutputEvent.Fork()
	defer dataCancel()

	end, endCancel := proc.EndEvent.Fork()
	defer endCancel()

	go func() {
		defer close(exitChan)

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
				err := stream.Send(&rpc.ConnectResponse{
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
		case event := <-end:
			err := stream.Send(&rpc.ConnectResponse{
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

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-exitChan:
		return nil
	}
}

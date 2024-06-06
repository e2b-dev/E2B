package process

import (
	"context"
	"fmt"
	"sync"

	"github.com/e2b-dev/infra/packages/envd/internal/services/process/handler"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"connectrpc.com/connect"
	"golang.org/x/sync/semaphore"
)

func (s *Service) Connect(ctx context.Context, req *connect.Request[rpc.ConnectRequest], stream *connect.ServerStream[rpc.ConnectResponse]) error {
	ctx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)

	proc, err := s.getProcess(req.Msg.GetProcess())
	if err != nil {
		return err
	}

	streamSemaphore := semaphore.NewWeighted(1)

	subscribeExit := make(chan struct{})
	defer close(subscribeExit)

	go func() {
		defer close(subscribeExit)

		subscribeToProcessData(ctx, cancel, proc, func(data *rpc.ProcessEvent_DataEvent) {
			semErr := streamSemaphore.Acquire(ctx, 1)
			if semErr != nil {
				cancel(connect.NewError(connect.CodeAborted, semErr))

				return
			}

			defer streamSemaphore.Release(1)

			streamErr := stream.Send(&rpc.ConnectResponse{
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

	exitChan, unsubscribe := proc.Exit.Subscribe()
	defer unsubscribe()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case exitInfo := <-exitChan:
		<-subscribeExit

		endSemErr := streamSemaphore.Acquire(ctx, 1)
		if endSemErr != nil {
			return connect.NewError(connect.CodeAborted, endSemErr)
		}

		streamErr := stream.Send(&rpc.ConnectResponse{
			Event: &rpc.ProcessEvent{
				Event: &rpc.ProcessEvent_End{
					End: &rpc.ProcessEvent_EndEvent{
						ExitCode: exitInfo.Code,
						Exited:   exitInfo.Exited,
						Error:    &exitInfo.Error,
						Status:   exitInfo.Status,
					},
				},
			},
		})

		streamSemaphore.Release(1)

		if streamErr != nil {
			return connect.NewError(connect.CodeUnknown, streamErr)
		}
	}

	return nil
}

func subscribeToProcessData(ctx context.Context, cancel context.CancelCauseFunc, proc *handler.Handler, handleData func(data *rpc.ProcessEvent_DataEvent)) {
	var wg sync.WaitGroup

	stdoutReader, stdoutCleanup := proc.Stdout.Add()
	defer stdoutCleanup()

	wg.Add(1)

	go func() {
		defer wg.Done()
		defer cancel(nil)

		buf := make([]byte, handler.DefaultChunkSize)

		for {
			select {
			case <-ctx.Done():
				return
			default:
				n, err := stdoutReader.Read(buf)
				if err != nil {
					cancel(connect.NewError(connect.CodeInternal, fmt.Errorf("failed to read from stdout for process: %w", err)))

					return
				}

				handleData(&rpc.ProcessEvent_DataEvent{
					Output: &rpc.ProcessEvent_DataEvent_Stdout{
						Stdout: buf[:n],
					},
				})
			}
		}
	}()

	stderrReader, stderrCleanup := proc.Stderr.Add()
	defer stderrCleanup()

	wg.Add(1)

	go func() {
		defer wg.Done()
		defer cancel(nil)

		buf := make([]byte, handler.DefaultChunkSize)

		for {
			select {
			case <-ctx.Done():
				return
			default:
				n, err := stderrReader.Read(buf)
				if err != nil {
					cancel(connect.NewError(connect.CodeInternal, fmt.Errorf("failed to read from stderr for process: %w", err)))

					return
				}

				handleData(&rpc.ProcessEvent_DataEvent{
					Output: &rpc.ProcessEvent_DataEvent_Stderr{
						Stderr: buf[:n],
					},
				})
			}
		}
	}()

	if proc.TtyOutput != nil {
		ttyReader, ttyCleanup := proc.TtyOutput.Add()
		defer ttyCleanup()

		wg.Add(1)

		go func() {
			defer wg.Done()
			defer cancel(nil)

			buf := make([]byte, handler.DefaultChunkSize)

			for {
				select {
				case <-ctx.Done():
					return
				default:
					n, err := ttyReader.Read(buf)
					if err != nil {
						cancel(connect.NewError(connect.CodeInternal, fmt.Errorf("failed to read from tty output for process: %w", err)))

						return
					}

					handleData(&rpc.ProcessEvent_DataEvent{
						Output: &rpc.ProcessEvent_DataEvent_Pty{
							Pty: buf[:n],
						},
					})
				}
			}
		}()
	}

	wg.Wait()
}

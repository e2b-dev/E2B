package process

import (
	"context"
	"fmt"
	"os"
	"sync"

	"github.com/e2b-dev/infra/packages/envd/internal/services/process/handler"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"connectrpc.com/connect"
	"golang.org/x/sync/semaphore"
)

func (s *Service) Connect(ctx context.Context, req *connect.Request[rpc.ConnectRequest], stream *connect.ServerStream[rpc.ConnectResponse]) error {
	proc, err := s.getProcess(req.Msg.GetProcess())
	if err != nil {
		return connect.NewError(connect.CodeNotFound, err)
	}

	streamSemaphore := semaphore.NewWeighted(1)

	subscribeExit := make(chan struct{})
	defer close(subscribeExit)

	go func() {
		defer close(subscribeExit)

		subscribeToProcessData(ctx, proc, func(data *rpc.ProcessEvent_DataEvent) {
			semErr := streamSemaphore.Acquire(ctx, 1)
			if semErr != nil {
				fmt.Fprintf(os.Stderr, "failed to acquire stream semaphore: %v\n", semErr)

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
				fmt.Fprintf(os.Stderr, "failed to send process event: %v\n", streamErr)

				return
			}
		})
	}()

	exitChan := proc.Exit.Subscribe()
	defer proc.Exit.Unsubscribe(exitChan)

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

		streamErr := stream.Send(&rpc.ConnectResponse{
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

func subscribeToProcessData(ctx context.Context, proc *handler.Handler, handleData func(data *rpc.ProcessEvent_DataEvent)) {
	var wg sync.WaitGroup

	stdoutReader, stdoutCleanup := proc.Stdout.Add()
	defer stdoutCleanup()

	wg.Add(1)
	go func() {
		defer wg.Done()

		buf := make([]byte, handler.DefaultChunkSize)

		for {
			select {
			case <-ctx.Done():
				return
			default:
				n, err := stdoutReader.Read(buf)
				if err != nil {
					fmt.Fprintf(os.Stderr, "failed to read from stdout for process: %v\n", err)

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

		buf := make([]byte, handler.DefaultChunkSize)

		for {
			select {
			case <-ctx.Done():
				return
			default:
				n, err := stderrReader.Read(buf)
				if err != nil {
					fmt.Fprintf(os.Stderr, "failed to read from stderr for process: %v\n", err)

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

	ttyReader, ttyCleanup := proc.TtyOutput.Add()
	defer ttyCleanup()

	wg.Add(1)
	go func() {
		defer wg.Done()

		buf := make([]byte, handler.DefaultChunkSize)

		for {
			select {
			case <-ctx.Done():
				return
			default:
				n, err := ttyReader.Read(buf)
				if err != nil {
					fmt.Fprintf(os.Stderr, "failed to read from tty output for process: %v\n", err)

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

	wg.Wait()
}

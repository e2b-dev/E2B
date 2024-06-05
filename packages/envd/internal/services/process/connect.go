package process

import (
	"context"
	"fmt"
	"io"
	"os"
	"sync"

	"github.com/e2b-dev/infra/packages/envd/internal/services/process/handler"
	rpc "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/process"

	"connectrpc.com/connect"
)

func (s *Service) Connect(ctx context.Context, req *connect.Request[rpc.ConnectRequest], stream *connect.ServerStream[rpc.ConnectResponse]) error {
	proc, err := s.getProcess(req.Msg.GetProcess())
	if err != nil {
		return connect.NewError(connect.CodeNotFound, err)
	}

	var streamMu sync.Mutex

	subscribeExit := make(chan struct{})
	defer close(subscribeExit)

	go func() {
		defer close(subscribeExit)

		subscribeToProcessData(ctx, proc, func(data *rpc.ProcessEvent_Data) {
			streamMu.Lock()
			defer streamMu.Unlock()

			streamErr := stream.Send(&rpc.ConnectResponse{
				Event: &rpc.ProcessEvent{
					Event: data,
				},
			})
			if streamErr != nil {
				fmt.Fprintf(os.Stderr, "failed to send process event: %v\n", streamErr)
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
		if streamErr != nil {
			return connect.NewError(connect.CodeInternal, streamErr)
		}
	}

	return nil
}

func subscribeToProcessData(ctx context.Context, proc *handler.Handler, handleData func(data *rpc.ProcessEvent_Data)) {
	var wg sync.WaitGroup

	stdoutReader, stdoutWriter := io.Pipe()
	proc.Stdout.Add(stdoutWriter)
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer stdoutWriter.Close()
		defer proc.Stdout.Remove(stdoutWriter)

		buf := make([]byte, handler.DefaultChunkSize)

		for {
			select {
			case <-ctx.Done():
				return
			default:
				n, err := stdoutReader.Read(buf)
				if err != nil {
					fmt.Fprintf(os.Stderr, "failed to read from stdout for process: %w\n", err)

					return
				}

				handleData(&rpc.ProcessEvent_Data{
					Data: &rpc.ProcessEvent_DataEvent{
						Output: &rpc.ProcessEvent_DataEvent_Stdout{
							Stdout: buf[:n],
						},
					},
				})
			}
		}
	}()

	stderrReader, stderrWriter := io.Pipe()
	proc.Stderr.Add(stderrWriter)
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer stderrWriter.Close()
		defer proc.Stderr.Remove(stderrWriter)

		buf := make([]byte, handler.DefaultChunkSize)

		for {
			select {
			case <-ctx.Done():
				return
			default:
				n, err := stderrReader.Read(buf)
				if err != nil {
					fmt.Fprintf(os.Stderr, "failed to read from stderr for process: %w\n", err)

					return
				}

				handleData(&rpc.ProcessEvent_Data{
					Data: &rpc.ProcessEvent_DataEvent{
						Output: &rpc.ProcessEvent_DataEvent_Stderr{
							Stderr: buf[:n],
						},
					},
				})
			}
		}
	}()

	ttyOutputReader, ttyOutputWriter := io.Pipe()
	proc.TtyOutput.Add(ttyOutputWriter)
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer ttyOutputWriter.Close()
		defer proc.TtyOutput.Remove(ttyOutputWriter)

		buf := make([]byte, handler.DefaultChunkSize)

		for {
			select {
			case <-ctx.Done():
				return
			default:
				n, err := ttyOutputReader.Read(buf)
				if err != nil {
					fmt.Fprintf(os.Stderr, "failed to read from tty output for process: %w\n", err)

					return
				}

				handleData(&rpc.ProcessEvent_Data{
					Data: &rpc.ProcessEvent_DataEvent{
						Output: &rpc.ProcessEvent_DataEvent_Pty{
							Pty: buf[:n],
						},
					},
				})
			}
		}
	}()

	wg.Wait()
}

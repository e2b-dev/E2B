package utils

import (
	"fmt"
	"strings"

	"connectrpc.com/connect"
	"github.com/aj-groq/E2B/packages/go-sdk/src/envd/process"
)

// ProcessResult contains the results of a process execution
type ProcessResult struct {
	Stdout   string
	Stderr   string
	ExitCode int32
	Error    string
	PID      uint32
}

// HandleProcessStream processes a stream and returns captured output
func HandleProcessStream(stream *connect.ServerStreamForClient[process.StartResponse]) (*ProcessResult, error) {
	defer stream.Close()

	result := &ProcessResult{
		ExitCode: -1, // Default to -1 for unknown/running
	}

	var stdout, stderr strings.Builder

	// Read stream responses
	for stream.Receive() {
		msg := stream.Msg()
		if msg.Event != nil {
			switch event := msg.Event.Event.(type) {
			case *process.ProcessEvent_Start:
				result.PID = event.Start.Pid
			case *process.ProcessEvent_Data:
				if data := event.Data; data != nil {
					switch output := data.Output.(type) {
					case *process.ProcessEvent_DataEvent_Stdout:
						stdout.Write(output.Stdout)
					case *process.ProcessEvent_DataEvent_Stderr:
						stderr.Write(output.Stderr)
					}
				}
			case *process.ProcessEvent_End:
				result.ExitCode = event.End.ExitCode
				if event.End.Error != nil {
					result.Error = *event.End.Error
				}
			}
		}
	}

	result.Stdout = strings.TrimSpace(stdout.String())
	result.Stderr = strings.TrimSpace(stderr.String())

	if err := stream.Err(); err != nil {
		return result, err
	}

	// Return error if process failed
	if result.ExitCode != 0 {
		errorMsg := fmt.Sprintf("process exited with code %d", result.ExitCode)
		if result.Error != "" {
			errorMsg += ": " + result.Error
		}
		return result, fmt.Errorf(errorMsg)
	}

	return result, nil
}

// HandleProcessStreamOutput is a convenience function that returns just the combined output
func HandleProcessStreamOutput(stream *connect.ServerStreamForClient[process.StartResponse]) (string, error) {
	result, err := HandleProcessStream(stream)
	if err != nil {
		// Still return output even if there was an error
		if result != nil {
			combined := result.Stdout
			if result.Stderr != "" {
				if combined != "" {
					combined += "\n"
				}
				combined += result.Stderr
			}
			return combined, err
		}
		return "", err
	}
	return result.Stdout, nil
}

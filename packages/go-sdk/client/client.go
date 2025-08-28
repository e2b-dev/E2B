package client

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/aj-groq/E2B/packages/go-sdk/src/envd/filesystem"
	"github.com/aj-groq/E2B/packages/go-sdk/src/envd/filesystem/filesystemconnect"
	"github.com/aj-groq/E2B/packages/go-sdk/src/envd/process"
	"github.com/aj-groq/E2B/packages/go-sdk/src/envd/process/processconnect"
	"github.com/aj-groq/E2B/packages/go-sdk/src/sandbox"
	"github.com/aj-groq/E2B/packages/go-sdk/src/utils"
)

// Client provides a simplified interface for E2B computer use
type Client struct {
	sandboxID        string
	clientID         string
	processClient    processconnect.ProcessClient
	filesystemClient filesystemconnect.FilesystemClient
	httpClient       *http.Client
}

// headerInterceptor adds required headers for envd communication
type headerInterceptor struct {
	sandboxID string
	clientID  string
}

func (i *headerInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		// Set Host header for envd routing
		host := fmt.Sprintf("49983-%s-%s.e2b.app", i.sandboxID, i.clientID)
		req.Header().Set("Host", host)

		// Set basic auth for user
		userAuth := base64.StdEncoding.EncodeToString([]byte("user:"))
		req.Header().Set("Authorization", fmt.Sprintf("Basic %s", userAuth))

		return next(ctx, req)
	}
}

func (i *headerInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, spec connect.Spec) connect.StreamingClientConn {
		conn := next(ctx, spec)

		// Set Host header for envd routing
		host := fmt.Sprintf("49983-%s-%s.e2b.app", i.sandboxID, i.clientID)
		conn.RequestHeader().Set("Host", host)

		// Set basic auth for user
		userAuth := base64.StdEncoding.EncodeToString([]byte("user:"))
		conn.RequestHeader().Set("Authorization", fmt.Sprintf("Basic %s", userAuth))

		return conn
	}
}

func (i *headerInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next
}

// New creates a new E2B client and sandbox for computer use
func New(templateID string, timeout int) (*Client, error) {
	// Create sandbox
	sbResp, err := sandbox.CreateSandbox(templateID, timeout)
	if err != nil {
		return nil, fmt.Errorf("failed to create sandbox: %v", err)
	}

	// Setup HTTP client
	httpClient := &http.Client{
		Timeout: 30 * time.Second,
	}

	// Create header interceptor
	interceptor := &headerInterceptor{
		sandboxID: sbResp.SandboxID,
		clientID:  sbResp.ClientID,
	}

	// Connect to envd endpoint
	envdURL := "https://envd.e2b.dev"

	// Create clients with proper headers
	processClient := processconnect.NewProcessClient(
		httpClient,
		envdURL,
		connect.WithInterceptors(interceptor),
	)
	filesystemClient := filesystemconnect.NewFilesystemClient(
		httpClient,
		envdURL,
		connect.WithInterceptors(interceptor),
	)

	return &Client{
		sandboxID:        sbResp.SandboxID,
		clientID:         sbResp.ClientID,
		processClient:    processClient,
		filesystemClient: filesystemClient,
		httpClient:       httpClient,
	}, nil
}

// Close terminates the sandbox
func (c *Client) Close() error {
	return sandbox.KillSandbox(c.sandboxID)
}

// SandboxID returns the sandbox ID
func (c *Client) SandboxID() string {
	return c.sandboxID
}

// ClientID returns the client ID
func (c *Client) ClientID() string {
	return c.clientID
}

// RunCommand executes a command and returns detailed results
func (c *Client) RunCommand(ctx context.Context, cmd string, args []string) (*utils.ProcessResult, error) {
	req := &process.StartRequest{
		Process: &process.ProcessConfig{
			Cmd:  cmd,
			Args: args,
		},
	}

	stream, err := c.processClient.Start(ctx, connect.NewRequest(req))
	if err != nil {
		return nil, err
	}

	return utils.HandleProcessStream(stream)
}

// RunCommandWithOutput executes a command and returns just the output as string
func (c *Client) RunCommandWithOutput(ctx context.Context, cmd string, args []string) (string, error) {
	req := &process.StartRequest{
		Process: &process.ProcessConfig{
			Cmd:  cmd,
			Args: args,
		},
	}

	stream, err := c.processClient.Start(ctx, connect.NewRequest(req))
	if err != nil {
		return "", err
	}

	return utils.HandleProcessStreamOutput(stream)
}

// RunCommandSimple executes a command and logs output (for compatibility)
func (c *Client) RunCommandSimple(ctx context.Context, cmd string, args []string) error {
	result, err := c.RunCommand(ctx, cmd, args)
	if err != nil {
		return err
	}

	// Log output for backward compatibility
	if result.Stdout != "" {
		log.Printf("stdout: %s", result.Stdout)
	}
	if result.Stderr != "" {
		log.Printf("stderr: %s", result.Stderr)
	}

	return nil
}

// RunShellCommand executes a shell command (bash -l -c) and returns detailed results
func (c *Client) RunShellCommand(ctx context.Context, command string) (*utils.ProcessResult, error) {
	return c.RunCommand(ctx, "/bin/bash", []string{"-l", "-c", command})
}

// RunShellCommandWithOutput executes a shell command and returns output - useful for computer use
func (c *Client) RunShellCommandWithOutput(ctx context.Context, command string) (string, error) {
	return c.RunCommandWithOutput(ctx, "/bin/bash", []string{"-l", "-c", command})
}

// RunShellCommandSimple executes a shell command and logs output (for compatibility)
func (c *Client) RunShellCommandSimple(ctx context.Context, command string) error {
	return c.RunCommandSimple(ctx, "/bin/bash", []string{"-l", "-c", command})
}

// ListProcesses returns running processes
func (c *Client) ListProcesses(ctx context.Context) (*connect.Response[process.ListResponse], error) {
	return c.processClient.List(ctx, connect.NewRequest(&process.ListRequest{}))
}

// ListDir lists directory contents
func (c *Client) ListDir(ctx context.Context, path string) (*connect.Response[filesystem.ListDirResponse], error) {
	req := &filesystem.ListDirRequest{
		Path: path,
	}
	return c.filesystemClient.ListDir(ctx, connect.NewRequest(req))
}

// MakeDir creates a directory
func (c *Client) MakeDir(ctx context.Context, path string) (*connect.Response[filesystem.MakeDirResponse], error) {
	req := &filesystem.MakeDirRequest{
		Path: path,
	}
	return c.filesystemClient.MakeDir(ctx, connect.NewRequest(req))
}

// Remove deletes a file or directory
func (c *Client) Remove(ctx context.Context, path string) (*connect.Response[filesystem.RemoveResponse], error) {
	req := &filesystem.RemoveRequest{
		Path: path,
	}
	return c.filesystemClient.Remove(ctx, connect.NewRequest(req))
}

// Helper Functions

// HandleProcessStream processes streaming responses from RunCommand
func HandleProcessStream(stream *connect.ServerStreamForClient[process.StartResponse]) error {
	defer stream.Close()

	// Read stream responses
	for stream.Receive() {
		msg := stream.Msg()
		if msg.Event != nil {
			switch event := msg.Event.Event.(type) {
			case *process.ProcessEvent_Start:
				log.Printf("Process started with PID: %d", event.Start.Pid)
			case *process.ProcessEvent_Data:
				if data := event.Data; data != nil {
					switch output := data.Output.(type) {
					case *process.ProcessEvent_DataEvent_Stdout:
						log.Printf("stdout: %s", string(output.Stdout))
					case *process.ProcessEvent_DataEvent_Stderr:
						log.Printf("stderr: %s", string(output.Stderr))
					}
				}
			case *process.ProcessEvent_End:
				log.Printf("Process ended with exit code: %d, status: %s", event.End.ExitCode, event.End.Status)
				if event.End.Error != nil {
					log.Printf("Error: %s", *event.End.Error)
				}
			}
		}
	}

	return stream.Err()
}

// Computer Use Helper Functions (extracted from vnc_commands.go)

// Key mapping for computer use automation
var KeyMapper = map[string]string{
	"enter":     "Return",
	"ret":       "Return",
	"esc":       "Escape",
	"ctrl":      "ctrl",
	"alt":       "alt",
	"shift":     "shift",
	"tab":       "Tab",
	"space":     "space",
	"backspace": "BackSpace",
	"delete":    "Delete",
	"left":      "Left",
	"right":     "Right",
	"up":        "Up",
	"down":      "Down",
	"home":      "Home",
	"end":       "End",
	"pageup":    "Page_Up",
	"pagedown":  "Page_Down",
}

// MapKey translates common key names for automation
func MapKey(key string) string {
	if mapped, exists := KeyMapper[strings.ToLower(key)]; exists {
		return mapped
	}
	return key
}

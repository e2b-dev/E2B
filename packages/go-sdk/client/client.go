package client

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"time"

	"connectrpc.com/connect"
	"github.com/e2b-dev/e2b/packages/go-sdk/src/envd/filesystem"
	"github.com/e2b-dev/e2b/packages/go-sdk/src/envd/filesystem/filesystemconnect"
	"github.com/e2b-dev/e2b/packages/go-sdk/src/envd/process"
	"github.com/e2b-dev/e2b/packages/go-sdk/src/envd/process/processconnect"
	"github.com/e2b-dev/e2b/packages/go-sdk/src/sandbox"
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

// RunCommand executes a command (simplified for computer use)
func (c *Client) RunCommand(ctx context.Context, cmd string, args []string) (*connect.ServerStreamForClient[process.StartResponse], error) {
	req := &process.StartRequest{
		Process: &process.ProcessConfig{
			Cmd:  cmd,
			Args: args,
		},
	}
	return c.processClient.Start(ctx, connect.NewRequest(req))
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

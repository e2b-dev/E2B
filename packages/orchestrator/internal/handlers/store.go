package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/e2b-dev/infra/packages/orchestrator/internal/api"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/instance"
	"github.com/e2b-dev/infra/packages/shared/pkg/smap"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

const shortNodeIDLength = 8

var (
	nodeID   = os.Getenv("NODE_ID")
	clientID = nodeID[:shortNodeIDLength]
)

type APIStore struct {
	Ctx       context.Context
	instances *smap.Map[*instance.Instance]
	dns       *instance.DNS
	tracer    trace.Tracer
}

func NewAPIStore() *APIStore {
	fmt.Println("Initializing API store")

	ctx := context.Background()

	dns, err := instance.NewDNS()
	if err != nil {
		panic(err)
	}

	return &APIStore{
		Ctx:       ctx,
		tracer:    otel.Tracer("orchestrator"),
		dns:       dns,
		instances: smap.New[*instance.Instance](),
	}
}

func (a *APIStore) Close() {}

// This function wraps sending of an error in the Error format, and
// handling the failure to marshal that.
func (a *APIStore) sendAPIStoreError(c *gin.Context, code int, message string) {
	apiErr := api.Error{
		Code:    int32(code),
		Message: message,
	}

	c.Error(fmt.Errorf(message))
	c.JSON(code, apiErr)
}

func (a *APIStore) GetHealth(c *gin.Context) {
	c.String(http.StatusOK, "Health check successful")
}

func (a *APIStore) PostSandboxes(c *gin.Context) {
	ctx := c.Request.Context()
	tracer := otel.Tracer("create")

	body, err := parseBody[api.Sandbox](ctx, c)
	if err != nil {
		fmt.Println("Error parsing request body")

		a.sendAPIStoreError(c, http.StatusBadRequest, "failed to parse request body")
		return
	}

	// fcVersionsDir := "/fc-versions"
	// uffdBinaryName := "uffd"
	// fcBinaryName := "firecracker"

	instance, err := instance.NewInstance(
		ctx,
		tracer,
		&instance.InstanceConfig{
			EnvID:            body.EnvID,
			NodeID:           nodeID,
			InstanceID:       body.InstanceID,
			TraceID:          body.TraceID,
			TeamID:           body.TeamID,
			ConsulToken:      body.ConsulToken,
			LogsProxyAddress: body.LogsProxyAddress,
			// KernelVersion:         body.KernelVersion,
			// EnvsDisk:              body.EnvsDisk,
			// KernelsDir:            "/fc-kernels",
			// KernelMountDir:        "/fc-vm",
			// KernelName:            "vmlinux.bin",
			HugePages: body.HugePages,
			// UFFDBinaryPath:        filepath.Join(fcVersionsDir, body.FirecrackerVersion, uffdBinaryName),
			// FirecrackerBinaryPath: filepath.Join(fcVersionsDir, body.FirecrackerVersion, fcBinaryName),

			AllocID:        "alloc-id",
			EnvsDisk:       "/mnt/disks/fc-envs/v1",
			KernelVersion:  "vmlinux-5.10.186",
			KernelMountDir: "/fc-vm",
			KernelsDir:     "/fc-kernels",
			KernelName:     "vmlinux.bin",
			UFFDBinaryPath: "/fc-versions/v1.7.0-dev_8bb88311/uffd",
			// HugePages:             true,
			FirecrackerBinaryPath: "/fc-versions/v1.7.0-dev_8bb88311/firecracker",
		},
		a.dns,
		&body,
	)
	if err != nil {
		errMsg := fmt.Errorf("failed to create instance: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		a.sendAPIStoreError(c, http.StatusInternalServerError, "failed to create instance")

		return
	}

	body.ClientID = &clientID

	a.instances.Insert(body.InstanceID, instance)

	go func() {
		tracer := otel.Tracer("close")
		defer instance.CleanupAfterFCStop(context.Background(), tracer, a.dns)
		defer a.instances.Remove(body.InstanceID)

		err := instance.FC.Wait()
		if err != nil {
			errMsg := fmt.Errorf("failed to wait for FC: %w", err)
			telemetry.ReportCriticalError(ctx, errMsg)
		}
	}()

	c.JSON(http.StatusCreated, api.NewSandbox{
		SandboxID: body.InstanceID,
		ClientID:  nodeID,
	})
}

func (a *APIStore) GetSandboxes(c *gin.Context) {
	var sandboxes []*api.Sandbox

	for _, instance := range a.instances.Items() {
		sandboxes = append(sandboxes, instance.Request)
	}

	c.JSON(http.StatusOK, sandboxes)
}

func (a *APIStore) DeleteSandboxesSandboxID(c *gin.Context, sandboxID string) {
	ctx := c.Request.Context()

	tracer := otel.Tracer("delete")

	instance, ok := a.instances.Get(sandboxID)
	if !ok {
		a.sendAPIStoreError(c, http.StatusNotFound, "sandbox not found")
		return
	}

	err := instance.FC.Stop(ctx, tracer)
	defer instance.CleanupAfterFCStop(ctx, tracer, a.dns)
	if err != nil {
		errMsg := fmt.Errorf("failed to stop FC: %w", err)

		telemetry.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusInternalServerError, "failed to stop FC")

		return
	}

	c.Status(http.StatusNoContent)
}

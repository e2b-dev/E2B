package nomad

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"net/http"
	"os"
	"strings"
	"text/template"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/utils"

	nomadAPI "github.com/hashicorp/nomad/api"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const (
	instanceJobName          = "env-instance"
	instanceJobNameWithSlash = instanceJobName + "/"
	instanceIDPrefix         = "i"

	instanceStartTimeout = time.Second * 20
)

var (
	logsProxyAddress = os.Getenv("LOGS_PROXY_ADDRESS")
	consulToken      = os.Getenv("CONSUL_TOKEN")
)

//go:embed env-instance.hcl
var envInstanceFile string
var envInstanceTemplate = template.Must(template.New(instanceJobName).Parse(envInstanceFile))

func (n *NomadClient) GetInstances() ([]*api.Instance, *api.APIError) {
	allocations, _, err := n.client.Allocations().List(&nomadAPI.QueryOptions{
		Filter: fmt.Sprintf("JobID contains \"%s\" and TaskStates.%s.State == \"%s\"", instanceJobNameWithSlash, defaultTaskName, taskRunningState),
	})
	if err != nil {
		errMsg := fmt.Errorf("failed to retrieve allocations from Nomad %w", err)

		return nil, &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot retrieve instances right now",
			Code:      http.StatusInternalServerError,
		}
	}

	instances := []*api.Instance{}
	for _, alloc := range allocations {
		instances = append(instances, &api.Instance{
			ClientID:   alloc.NodeID[:shortNodeIDLength],
			InstanceID: alloc.JobID[len(instanceJobNameWithSlash):],
			// TODO: Add envID from the job meta
		})
	}

	return instances, nil
}

func (n *NomadClient) CreateInstance(
	t trace.Tracer,
	ctx context.Context,
	envID string,
) (*api.Instance, *api.APIError) {
	childCtx, childSpan := t.Start(ctx, "create-instance",
		trace.WithAttributes(
			attribute.String("env_id", envID),
		),
	)
	defer childSpan.End()

	instanceID := instanceIDPrefix + utils.GenerateID()

	traceID := childSpan.SpanContext().TraceID().String()
	spanID := childSpan.SpanContext().SpanID().String()

	childSpan.SetAttributes(
		attribute.String("passed_trace_id_hex", traceID),
		attribute.String("passed_span_id_hex", spanID),
	)

	var jobDef bytes.Buffer

	jobVars := struct {
		SpanID           string
		ConsulToken      string
		TraceID          string
		EnvID            string
		InstanceID       string
		LogsProxyAddress string
		TaskName         string
		JobName          string
		EnvsDisk         string
	}{
		SpanID:           spanID,
		TraceID:          traceID,
		LogsProxyAddress: logsProxyAddress,
		ConsulToken:      consulToken,
		EnvID:            envID,
		InstanceID:       instanceID,
		TaskName:         defaultTaskName,
		JobName:          instanceJobName,
		EnvsDisk:         envsDisk,
	}

	err := envInstanceTemplate.Execute(&jobDef, jobVars)
	if err != nil {
		errMsg := fmt.Errorf("failed to `envInstanceJobTemp.Execute()`: %w", err)

		return nil, &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot create a environment instance right now",
			Code:      http.StatusInternalServerError,
		}
	}

	job, err := n.client.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		errMsg := fmt.Errorf("failed to parse the HCL job file %+s: %w", jobDef.String(), err)

		return nil, &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot create a environment instance right now",
			Code:      http.StatusInternalServerError,
		}
	}

	result := make(chan AllocResult)
	defer close(result)

	go n.WaitForJob(childCtx, *job.ID, taskRunningState, result, instanceStartTimeout)

	_, _, err = n.client.Jobs().Register(job, nil)
	if err != nil {
		errMsg := fmt.Errorf("failed to register '%s%s' job: %w", instanceJobNameWithSlash, jobVars.InstanceID, err)

		return nil, &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot create a environment instance right now",
			Code:      http.StatusInternalServerError,
		}
	}

	allocResult := <-result
	if allocResult.Err != nil {
		errMsg := fmt.Errorf("failed to create instance of environment '%s': %w", envID, allocResult.Err)

		apiErr := n.DeleteInstance(instanceID, false)
		if apiErr != nil {
			cleanupErr := fmt.Errorf("error in cleanup after failing to create instance of environment error: %w: %w", apiErr.Err, errMsg)

			return nil, &api.APIError{
				Err:       cleanupErr,
				ClientMsg: "Cannot create a environment instance right now",
				Code:      http.StatusInternalServerError,
			}
		}

		return nil, &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot create a environment instance right now",
			Code:      http.StatusInternalServerError,
		}
	}

	childSpan.SetAttributes(
		attribute.String("instance_id", instanceID),
	)

	if allocResult.Alloc == nil {
		errMsg := fmt.Errorf("allocation is nil")

		return nil, &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot create a environment instance right now",
			Code:      http.StatusInternalServerError,
		}
	}

	instance := &api.Instance{
		ClientID:   strings.Clone(allocResult.Alloc.NodeID[:shortNodeIDLength]),
		InstanceID: instanceID,
		EnvID:      envID,
	}

	return instance, nil
}

func (n *NomadClient) DeleteInstance(instanceID string, purge bool) *api.APIError {
	_, _, err := n.client.Jobs().Deregister(instanceJobNameWithSlash+instanceID, purge, nil)
	if err != nil {
		errMsg := fmt.Errorf("cannot delete job '%s%s' job: %w", instanceJobNameWithSlash, instanceID, err)

		return &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot delete the environment instance right now",
			Code:      http.StatusInternalServerError,
		}
	}

	return nil
}

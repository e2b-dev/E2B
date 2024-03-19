package nomad

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"text/template"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/nomad/cache/instance"
	"github.com/e2b-dev/infra/packages/api/internal/sandbox"
	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"github.com/google/uuid"

	nomadAPI "github.com/hashicorp/nomad/api"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const (
	instanceJobName          = "env-instance"
	instanceJobNameWithSlash = instanceJobName + "/"
	instanceIDPrefix         = "i"

	instanceStartTimeout = time.Second * 20

	envIDMetaKey             = "ENV_ID"
	buildIDMetaKey           = "BUILD_ID"
	aliasMetaKey             = "ALIAS"
	instanceIDMetaKey        = "INSTANCE_ID"
	teamIDMetaKey            = "TEAM_ID"
	maxInstanceLengthMetaKey = "MAX_INSTANCE_LENGTH_HOURS"
	metadataKey              = "METADATA"
)

var (
	logsProxyAddress = os.Getenv("LOGS_PROXY_ADDRESS")
	consulToken      = os.Getenv("CONSUL_TOKEN")
)

//go:embed env-instance.hcl
var envInstanceFile string
var envInstanceTemplate = template.Must(template.New(instanceJobName).Parse(envInstanceFile))

func (n *NomadClient) GetInstances() ([]*instance.InstanceInfo, *api.APIError) {
	jobs, _, err := n.client.Jobs().ListOptions(&nomadAPI.JobListOptions{
		Fields: &nomadAPI.JobListFields{
			Meta: true,
		},
	}, &nomadAPI.QueryOptions{
		Filter: fmt.Sprintf("ID contains \"%s\" and Status == \"%s\"", instanceJobNameWithSlash, jobRunningStatus),
	})
	if err != nil {
		errMsg := fmt.Errorf("failed to get jobs from Nomad: %w", err)

		return nil, &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot retrieve instances right now",
			Code:      http.StatusInternalServerError,
		}
	}

	allocations, _, err := n.client.Allocations().List(&nomadAPI.QueryOptions{
		Filter: fmt.Sprintf("JobID contains \"%s\"", instanceJobNameWithSlash),
	})
	if err != nil {
		errMsg := fmt.Errorf("failed to get allocations from Nomad: %w", err)

		return nil, &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot retrieve instances right now",
			Code:      http.StatusInternalServerError,
		}
	}

	nodeMap := make(map[string]string, len(allocations))
	for _, alloc := range allocations {
		nodeMap[alloc.JobID] = alloc.NodeID[:shortNodeIDLength]
	}

	instances := make([]*instance.InstanceInfo, 0, len(jobs))

	for _, job := range jobs {
		instanceID := job.Meta[instanceIDMetaKey]
		envID := job.Meta[envIDMetaKey]
		buildID := job.Meta[buildIDMetaKey]
		aliasRaw := job.Meta[aliasMetaKey]
		teamID := job.Meta[teamIDMetaKey]
		metadataRaw := job.Meta[metadataKey]
		maxInstanceLengthHoursString := job.Meta[maxInstanceLengthMetaKey]
		maxInstanceLengthInt, err := strconv.Atoi(maxInstanceLengthHoursString)

		var maxInstanceLength time.Duration

		if err == nil {
			maxInstanceLength = time.Duration(maxInstanceLengthInt) * time.Hour
		} else {
			n.logger.Errorf("failed to parse max instance length for job '%s': %v", job.ID, err)

			// Default to 1 hour (the length of the for base tier)
			maxInstanceLength = time.Hour
		}

		var metadata map[string]string

		err = json.Unmarshal([]byte(metadataRaw), &metadata)
		if err != nil {
			n.logger.Errorf("failed to unmarshal metadata for job '%s': %v", job.ID, err)
		}

		var teamUUID *uuid.UUID
		var buildUUID *uuid.UUID
		var alias *string

		if teamID != "" {
			parsedTeamID, parseErr := uuid.Parse(teamID)
			if parseErr != nil {
				n.logger.Errorf("failed to parse team ID '%s' for job '%s': %v\n", teamID, job.ID, parseErr)
			} else {
				teamUUID = &parsedTeamID
			}
		}

		if buildID != "" {
			parsedBuildID, parseErr := uuid.Parse(buildID)
			if parseErr != nil {
				n.logger.Errorf("failed to parse build ID '%s' for job '%s': %v\n", buildID, job.ID, err)
			}
			buildUUID = &parsedBuildID
		}

		if aliasRaw != "" {
			alias = &aliasRaw
		}

		clientID, ok := nodeMap[job.ID]
		if !ok {
			n.logger.Errorf("failed to get client ID for job '%s'", job.ID)
		}

		instances = append(instances, &instance.InstanceInfo{
			Instance: &api.Sandbox{
				SandboxID:  instanceID,
				TemplateID: envID,
				Alias:      alias,
				ClientID:   clientID,
			},
			BuildID:           buildUUID,
			TeamID:            teamUUID,
			Metadata:          metadata,
			MaxInstanceLength: maxInstanceLength,
		})
	}

	return instances, nil
}

func (n *NomadClient) CreateSandbox(
	t trace.Tracer,
	ctx context.Context,
	envID,
	alias,
	teamID,
	buildID string,
	maxInstanceLengthHours int64,
	metadata map[string]string,
	kernelVersion,
	firecrackerVersion string,
) (*api.Sandbox, *api.APIError) {
	childCtx, childSpan := t.Start(ctx, "create-instance",
		trace.WithAttributes(
			attribute.String("env.id", envID),
		),
	)
	defer childSpan.End()

	instanceID := instanceIDPrefix + utils.GenerateID()

	traceID := childSpan.SpanContext().TraceID().String()
	spanID := childSpan.SpanContext().SpanID().String()

	metadataSerialized, err := json.Marshal(metadata)
	if err != nil {
		errMsg := fmt.Errorf("failed to marshal metadata: %w", err)

		return nil, &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot create a environment instance right now",
			Code:      http.StatusInternalServerError,
		}
	}

	telemetry.SetAttributes(
		childCtx,
		attribute.String("passed_trace_id_hex", traceID),
		attribute.String("passed_span_id_hex", spanID),
	)

	features, err := sandbox.NewVersionInfo(firecrackerVersion)
	if err != nil {
		errMsg := fmt.Errorf("failed to get features for firecracker version '%s': %w", firecrackerVersion, err)

		return nil, &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot create a environment instance right now",
			Code:      http.StatusInternalServerError,
		}
	}

	var jobDef bytes.Buffer

	jobVars := struct {
		SpanID               string
		ConsulToken          string
		TraceID              string
		EnvID                string
		BuildID              string
		Alias                string
		InstanceID           string
		LogsProxyAddress     string
		KernelVersion        string
		FirecrackerVersion   string
		TaskName             string
		JobName              string
		EnvsDisk             string
		TeamID               string
		EnvIDKey             string
		BuildIDKey           string
		AliasKey             string
		InstanceIDKey        string
		TeamIDKey            string
		MaxInstanceLengthKey string
		MaxInstanceLength    string
		MetadataKey          string
		Metadata             string
		HugePages            bool
	}{
		HugePages:            features.HasHugePages(),
		TeamIDKey:            teamIDMetaKey,
		BuildIDKey:           buildIDMetaKey,
		EnvIDKey:             envIDMetaKey,
		AliasKey:             aliasMetaKey,
		InstanceIDKey:        instanceIDMetaKey,
		MaxInstanceLengthKey: maxInstanceLengthMetaKey,
		MetadataKey:          metadataKey,
		KernelVersion:        kernelVersion,
		FirecrackerVersion:   firecrackerVersion,
		SpanID:               spanID,
		TeamID:               teamID,
		BuildID:              buildID,
		TraceID:              traceID,
		LogsProxyAddress:     logsProxyAddress,
		ConsulToken:          consulToken,
		EnvID:                envID,
		Alias:                strings.ReplaceAll(alias, "\"", "\\\""),
		MaxInstanceLength:    strconv.FormatInt(maxInstanceLengthHours, 10),
		InstanceID:           instanceID,
		TaskName:             defaultTaskName,
		JobName:              instanceJobName,
		EnvsDisk:             envsDisk,
		Metadata:             strings.ReplaceAll(string(metadataSerialized), "\"", "\\\""),
	}

	err = envInstanceTemplate.Execute(&jobDef, jobVars)
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

	sub := n.newSubscriber(*job.ID, taskRunningState, defaultTaskName)
	defer sub.close()

	_, _, err = n.client.Jobs().Register(job, nil)
	if err != nil {
		errMsg := fmt.Errorf("failed to register '%s%s' job: %w", instanceJobNameWithSlash, jobVars.InstanceID, err)

		return nil, &api.APIError{
			Err:       errMsg,
			ClientMsg: "Cannot create a environment instance right now",
			Code:      http.StatusInternalServerError,
		}
	}

	telemetry.ReportEvent(childCtx, "Started waiting for job to start")

	select {
	case <-ctx.Done():
		errMsg := fmt.Errorf("error waiting for env '%s' instance: %w", envID, ctx.Err())

		delErr := n.DeleteInstance(instanceID, false)
		if delErr != nil {
			cleanupErr := fmt.Errorf("error in cleanup after failing to create instance of environment error: %w: %w", delErr.Err, errMsg)

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
	case <-time.After(instanceStartTimeout):
		errMsg := fmt.Errorf("failed to create instance of environment '%s'", envID)

		delErr := n.DeleteInstance(instanceID, false)
		if delErr != nil {
			cleanupErr := fmt.Errorf("error in cleanup after failing to create instance of environment error: %w: %w", delErr.Err, errMsg)

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
	case alloc := <-sub.wait:
		var allocErr error

		defer func() {
			if allocErr != nil {
				cleanupErr := n.DeleteInstance(*job.ID, false)
				if cleanupErr != nil {
					errMsg := fmt.Errorf("error in cleanup after failing to create instance of environment '%s': %w", envID, cleanupErr.Err)
					telemetry.ReportError(childCtx, errMsg)
				} else {
					telemetry.ReportEvent(childCtx, "cleaned up env instance job", attribute.String("env.id", envID), attribute.String("instance.id", instanceID))
				}
			}
		}()

		if alloc.TaskStates == nil {
			allocErr = fmt.Errorf("task states are nil")

			telemetry.ReportCriticalError(childCtx, allocErr)

			return nil, &api.APIError{
				Err:       allocErr,
				ClientMsg: "Cannot create a environment instance right now",
				Code:      http.StatusInternalServerError,
			}
		}

		if alloc.TaskStates[defaultTaskName] == nil {
			allocErr = fmt.Errorf("task state '%s' is nil", defaultTaskName)

			telemetry.ReportCriticalError(childCtx, allocErr)

			return nil, &api.APIError{
				Err:       allocErr,
				ClientMsg: "Cannot create a environment instance right now",
				Code:      http.StatusInternalServerError,
			}
		}

		task := alloc.TaskStates[defaultTaskName]

		var instanceErr error

		if task.Failed {
			for _, event := range task.Events {
				if event.Type == "Terminated" {
					instanceErr = fmt.Errorf("%s", event.Message)
				}
			}

			if instanceErr == nil {
				allocErr = fmt.Errorf("starting instance failed")
			} else {
				allocErr = fmt.Errorf("starting instance failed: %w", instanceErr)
			}

			telemetry.ReportCriticalError(childCtx, allocErr)

			return nil, &api.APIError{
				Err:       allocErr,
				ClientMsg: "Cannot create a environment instance right now",
				Code:      http.StatusInternalServerError,
			}
		}

		// We accept pending state as well because it means that the task is starting (and the env exists because we checked the DB)
		// This usually speeds up the start from client
		if task.State != taskRunningState && task.State != taskPendingState {
			allocErr = fmt.Errorf("task state is not '%s' - it is '%s'", taskRunningState, task.State)

			telemetry.ReportCriticalError(childCtx, allocErr)

			return nil, &api.APIError{
				Err:       allocErr,
				ClientMsg: "Cannot create a environment instance right now",
				Code:      http.StatusInternalServerError,
			}
		}

		return &api.Sandbox{
			ClientID:   strings.Clone(alloc.NodeID[:shortNodeIDLength]),
			SandboxID:  instanceID,
			TemplateID: envID,
			Alias:      &alias,
		}, nil
	}
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

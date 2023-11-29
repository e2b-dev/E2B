package nomad

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"text/template"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const (
	envsDisk = "/mnt/disks/fc-envs/v1"

	buildJobName          = "env-build"
	buildJobNameWithSlash = buildJobName + "/"

	buildFinishTimeout = time.Minute * 30

	deleteJobName          = "env-delete"
	deleteJobNameWithSlash = deleteJobName + "/"

	deleteFinishTimeout = time.Second * 30

	deleteTaskName = "delete-env"
)

type BuildConfig struct {
	DiskSizeMB int64
	VCpuCount  int64
	MemoryMB   int64
}

//go:embed env-build.hcl
var envBuildFile string

//go:embed env-delete.hcl
var envDeleteFile string

var (
	envBuildTemplate  = template.Must(template.New(buildJobName).Funcs(template.FuncMap{}).Parse(envBuildFile))
	envDeleteTemplate = template.Must(template.New(deleteJobName).Funcs(template.FuncMap{}).Parse(envDeleteFile))
)

func (n *NomadClient) BuildEnvJob(
	t trace.Tracer,
	ctx context.Context,
	envID,
	// build is used to separate builds of the same env that can start simultaneously. Should be an UUID generated on server.
	buildID,
	startCmd,
	apiSecret,
	googleServiceAccountBase64 string,
	vmConfig BuildConfig,
) error {
	childCtx, childSpan := t.Start(ctx, "build-env-job")
	defer childSpan.End()

	traceID := childSpan.SpanContext().TraceID().String()
	spanID := childSpan.SpanContext().SpanID().String()

	telemetry.SetAttributes(
		childCtx,
		attribute.String("passed_trace_id_hex", traceID),
		attribute.String("passed_span_id_hex", spanID),
		attribute.String("env.id", envID),
		attribute.String("build.id", buildID),
		attribute.Int64("build.disk_size_mb", vmConfig.DiskSizeMB),
		attribute.Int64("build.vcpu_count", vmConfig.VCpuCount),
		attribute.Int64("build.memory_mb", vmConfig.MemoryMB),
	)

	var jobDef bytes.Buffer

	jobVars := struct {
		APISecret                  string
		BuildID                    string
		EnvID                      string
		SpanID                     string
		StartCmd                   string
		TraceID                    string
		JobName                    string
		TaskName                   string
		EnvsDisk                   string
		GoogleServiceAccountBase64 string
		GCPProjectID               string
		GCPLocation                string
		DockerRepositoryName       string
		VCpuCount                  int64
		MemoryMB                   int64
		DiskSizeMB                 int64
	}{
		APISecret:                  apiSecret,
		BuildID:                    buildID,
		StartCmd:                   startCmd,
		SpanID:                     spanID,
		DiskSizeMB:                 vmConfig.DiskSizeMB,
		VCpuCount:                  vmConfig.VCpuCount,
		MemoryMB:                   vmConfig.MemoryMB,
		TraceID:                    traceID,
		EnvID:                      envID,
		TaskName:                   defaultTaskName,
		JobName:                    buildJobName,
		EnvsDisk:                   envsDisk,
		GoogleServiceAccountBase64: googleServiceAccountBase64,
		GCPProjectID:               constants.ProjectID,
		GCPLocation:                constants.Location,
		DockerRepositoryName:       constants.DockerRepositoryName,
	}

	err := envBuildTemplate.Execute(&jobDef, jobVars)
	if err != nil {
		return fmt.Errorf("failed to `envBuildJobTemp.Execute()`: %w", err)
	}

	job, err := n.client.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return fmt.Errorf("failed to parse the HCL job file %+s: %w", jobDef.String(), err)
	}

	sub := n.newSubscriber(*job.ID, taskDeadState, defaultTaskName)
	defer sub.close()

	_, _, err = n.client.Jobs().Register(job, nil)
	if err != nil {
		return fmt.Errorf("failed to register '%s%s' job: %w", buildJobNameWithSlash, jobVars.EnvID, err)
	}

	select {
	case <-childCtx.Done():
		cleanupErr := n.DeleteEnvBuild(*job.ID, false)
		if cleanupErr != nil {
			return fmt.Errorf("error in cleanup after failing to create instance of environment '%s': %w", envID, cleanupErr)
		}

		return fmt.Errorf("error waiting for env '%s' build", envID)
	case <-time.After(buildFinishTimeout):
		cleanupErr := n.DeleteEnvBuild(*job.ID, false)
		if cleanupErr != nil {
			return fmt.Errorf("error in cleanup after failing to create instance of environment '%s': %w", envID, cleanupErr)
		}

		return fmt.Errorf("timeout waiting for env '%s' build", envID)

	case alloc := <-sub.wait:
		var allocErr error

		defer func() {
			cleanupErr := n.DeleteEnvBuild(*job.ID, allocErr == nil)
			if cleanupErr != nil {
				errMsg := fmt.Errorf("error in cleanup after failing to build environment '%s': %w", envID, cleanupErr)
				telemetry.ReportError(childCtx, errMsg)
			} else {
				telemetry.ReportEvent(childCtx, "cleaned up env build job", attribute.String("env.id", envID))
			}
		}()

		if alloc.TaskStates == nil {
			allocErr = fmt.Errorf("task states are nil")

			telemetry.ReportCriticalError(childCtx, allocErr)

			return allocErr
		}

		if alloc.TaskStates[defaultTaskName] == nil {
			allocErr = fmt.Errorf("task state '%s' is nil", defaultTaskName)

			telemetry.ReportCriticalError(childCtx, allocErr)

			return allocErr
		}

		task := alloc.TaskStates[defaultTaskName]

		var buildErr error

		if task.Failed {
			for _, event := range task.Events {
				if event.Type == "Terminated" {
					buildErr = fmt.Errorf("%s", event.Message)
				}
			}

			if buildErr == nil {
				allocErr = fmt.Errorf("building failed")
			} else {
				allocErr = fmt.Errorf("building failed %w", buildErr)
			}

			telemetry.ReportCriticalError(childCtx, allocErr)

			return allocErr
		}

		return nil
	}
}

func (n *NomadClient) DeleteEnvBuild(jobID string, purge bool) error {
	_, _, err := n.client.Jobs().Deregister(jobID, purge, nil)
	if err != nil {
		return fmt.Errorf("cannot delete job '%s%s' job: %w", buildJobNameWithSlash, jobID, err)
	}

	return nil
}

func (n *NomadClient) DeleteEnv(t trace.Tracer, ctx context.Context, envID string) error {
	childCtx, childSpan := t.Start(ctx, "delete-env-job")
	defer childSpan.End()

	traceID := childSpan.SpanContext().TraceID().String()
	spanID := childSpan.SpanContext().SpanID().String()

	telemetry.SetAttributes(
		childCtx,
		attribute.String("passed_trace_id_hex", traceID),
		attribute.String("passed_span_id_hex", spanID),
		attribute.String("env.id", envID),
	)

	var jobDef bytes.Buffer

	jobVars := struct {
		EnvID      string
		FCEnvsDisk string
		JobName    string
		TaskName   string
	}{
		EnvID:      envID,
		FCEnvsDisk: envsDisk,
		JobName:    deleteJobName,
		TaskName:   deleteTaskName,
	}

	err := envDeleteTemplate.Execute(&jobDef, jobVars)
	if err != nil {
		return fmt.Errorf("failed to `envDeleteJobTemp.Execute()`: %w", err)
	}

	job, err := n.client.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return fmt.Errorf("failed to parse the HCL job file %+s: %w", jobDef.String(), err)
	}

	sub := n.newSubscriber(*job.ID, taskDeadState, deleteTaskName)
	defer sub.close()

	_, _, err = n.client.Jobs().Register(job, nil)
	if err != nil {
		return fmt.Errorf("failed to register '%s%s' job: %w", deleteJobNameWithSlash, jobVars.EnvID, err)
	}

	select {
	case <-childCtx.Done():
		return fmt.Errorf("error waiting for env '%s' delete", envID)
	case <-time.After(deleteFinishTimeout):
		return fmt.Errorf("timeout waiting for env '%s' delete", envID)

	case alloc := <-sub.wait:
		var allocErr error

		defer func() {
			_, _, deregisterErr := n.client.Jobs().Deregister(*job.ID, allocErr == nil, nil)
			if deregisterErr != nil {
				errMsg := fmt.Errorf("error in cleanup after failing to delete environment '%s': %w", envID, deregisterErr)
				telemetry.ReportError(childCtx, errMsg)
			} else {
				telemetry.ReportEvent(childCtx, "cleaned up env delete job", attribute.String("env.id", envID))
			}
		}()

		if alloc.TaskStates == nil {
			allocErr = fmt.Errorf("task states are nil")

			telemetry.ReportCriticalError(childCtx, allocErr)

			return allocErr
		}

		if alloc.TaskStates[deleteTaskName] == nil {
			allocErr = fmt.Errorf("task state '%s' is nil", deleteTaskName)

			telemetry.ReportCriticalError(childCtx, allocErr)

			return allocErr
		}

		task := alloc.TaskStates[deleteTaskName]

		var deleteErr error

		if task.Failed {
			for _, event := range task.Events {
				if event.Type == "Terminated" {
					deleteErr = fmt.Errorf("%s", event.Message)
				}
			}

			if deleteErr == nil {
				allocErr = fmt.Errorf("deleting failed")
			} else {
				allocErr = fmt.Errorf("deleting failed %w", deleteErr)
			}

			telemetry.ReportCriticalError(childCtx, allocErr)

			return allocErr
		}

		return nil
	}
}

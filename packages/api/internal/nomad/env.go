package nomad

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"strconv"
	"strings"
	"text/template"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/api/internal/sandbox"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

const (
	envsDisk = "/mnt/disks/fc-envs/v1"

	buildJobName          = "env-build"
	buildJobNameWithSlash = buildJobName + "/"

	buildFinishTimeout = time.Hour

	deleteJobName          = "env-delete"
	deleteJobNameWithSlash = deleteJobName + "/"

	deleteFinishTimeout = time.Second * 30

	deleteTaskName = "delete-env"
)

type BuildConfig struct {
	KernelVersion      string
	FirecrackerVersion string
	DiskSizeMB         int64
	VCpuCount          int64
	MemoryMB           int64
}

//go:embed env-build.hcl
var envBuildFile string

//go:embed template-delete.hcl
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
) (int64, error) {
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
		attribute.String("build.kernel.version", vmConfig.KernelVersion),
		attribute.String("build.firecracker.version", vmConfig.FirecrackerVersion),
		attribute.Int64("build.vcpu_count", vmConfig.VCpuCount),
		attribute.Int64("build.memory_mb", vmConfig.MemoryMB),
	)

	version, err := sandbox.NewVersionInfo(vmConfig.FirecrackerVersion)
	if err != nil {
		return 0, fmt.Errorf("failed to parse firecracker version: %w", err)
	}

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
		GCPRegion                  string
		GCPZone                    string
		DockerRepositoryName       string
		KernelVersion              string
		FirecrackerVersion         string
		VCpuCount                  int64
		MemoryMB                   int64
		DiskSizeMB                 int64
		NomadToken                 string
		HugePages                  bool
	}{
		HugePages:                  version.HasHugePages(),
		APISecret:                  apiSecret,
		BuildID:                    buildID,
		StartCmd:                   strings.ReplaceAll(startCmd, "\"", "\\\""),
		SpanID:                     spanID,
		DiskSizeMB:                 vmConfig.DiskSizeMB,
		VCpuCount:                  vmConfig.VCpuCount,
		MemoryMB:                   vmConfig.MemoryMB,
		KernelVersion:              strings.ReplaceAll(vmConfig.KernelVersion, "\"", "\\\""),
		FirecrackerVersion:         strings.ReplaceAll(vmConfig.FirecrackerVersion, "\"", "\\\""),
		TraceID:                    traceID,
		EnvID:                      envID,
		TaskName:                   defaultTaskName,
		JobName:                    buildJobName,
		EnvsDisk:                   envsDisk,
		GoogleServiceAccountBase64: googleServiceAccountBase64,
		GCPProjectID:               constants.ProjectID,
		GCPRegion:                  constants.Region,
		GCPZone:                    constants.Zone,
		DockerRepositoryName:       constants.DockerRepositoryName,
		NomadToken:                 nomadToken,
	}

	err = envBuildTemplate.Execute(&jobDef, jobVars)
	if err != nil {
		return 0, fmt.Errorf("failed to `envBuildJobTemp.Execute()`: %w", err)
	}

	job, err := n.client.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return 0, fmt.Errorf("failed to parse the HCL job file %+s: %w", jobDef.String(), err)
	}

	sub := n.newSubscriber(*job.ID, taskDeadState, defaultTaskName)
	defer sub.close()

	_, _, err = n.client.Jobs().Register(job, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to register '%s%s' job: %w", buildJobNameWithSlash, jobVars.EnvID, err)
	}

	select {
	case <-childCtx.Done():
		cleanupErr := n.DeleteEnvBuild(*job.ID, false)
		if cleanupErr != nil {
			return 0, fmt.Errorf("error in cleanup after failing to create instance of environment '%s': %w", envID, cleanupErr)
		}

		return 0, fmt.Errorf("error waiting for env '%s' build", envID)
	case <-time.After(buildFinishTimeout):
		cleanupErr := n.DeleteEnvBuild(*job.ID, false)
		if cleanupErr != nil {
			return 0, fmt.Errorf("error in cleanup after failing to create instance of environment '%s': %w", envID, cleanupErr)
		}

		return 0, fmt.Errorf("timeout waiting for env '%s' build", envID)

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

			return 0, allocErr
		}

		if alloc.TaskStates[defaultTaskName] == nil {
			allocErr = fmt.Errorf("task state '%s' is nil", defaultTaskName)

			telemetry.ReportCriticalError(childCtx, allocErr)

			return 0, allocErr
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
				allocErr = fmt.Errorf("building failed: %w", buildErr)
			}

			telemetry.ReportCriticalError(childCtx, allocErr)

			return 0, allocErr
		}

		variable, _, err := n.client.Variables().GetVariableItems("env-build/disk-size-mb/"+envID, nil)
		if err != nil {
			return 0, fmt.Errorf("cannot get disk size variable: %w", err)
		}

		if size, ok := variable[buildID]; ok {
			sizeParsed, err := strconv.ParseInt(size, 10, 64)
			if err != nil {
				return 0, fmt.Errorf("cannot parse disk size variable: %w", err)
			}

			return sizeParsed, nil
		}

		_, err = n.client.Variables().Delete("env-build/disk-size-mb/"+envID, nil)
		if err != nil {
			telemetry.ReportError(childCtx, fmt.Errorf("cannot delete disk size variable: %w", err))
		}

		return 0, fmt.Errorf("didn't find disk size for the build: %w", err)
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
	childCtx, childSpan := t.Start(ctx, "delete-template-job")
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
		JobName            string
		SpanID             string
		TraceID            string
		TaskName           string
		TemplateID         string
		ProjectID          string
		Region             string
		GCPZone            string
		DockerContextsPath string
		DockerRegistry     string
		EnvsDisk           string
		BucketName         string
	}{
		SpanID:         spanID,
		TraceID:        traceID,
		TemplateID:     envID,
		ProjectID:      constants.ProjectID,
		Region:         constants.Region,
		GCPZone:        constants.Zone,
		DockerRegistry: constants.DockerRepositoryName,
		EnvsDisk:       envsDisk,
		BucketName:     constants.DockerContextBucketName,
		JobName:        deleteJobName,
		TaskName:       deleteTaskName,
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
		return fmt.Errorf("failed to register '%s%s' job: %w", deleteJobNameWithSlash, envID, err)
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

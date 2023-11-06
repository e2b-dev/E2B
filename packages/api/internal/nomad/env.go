package nomad

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"text/template"
	"time"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const (
	envsDisk = "/mnt/disks/fc-envs/v1"

	buildJobName          = "env-build"
	buildJobNameWithSlash = buildJobName + "/"

	buildFinishTimeout = time.Minute * 30
)

type BuildConfig struct {
	DiskSizeMB int64
	VCpuCount  int64
	MemoryMB   int64
}

//go:embed env-build.hcl
var envBuildFile string

var envBuildTemplate = template.Must(template.New(buildJobName).Funcs(template.FuncMap{}).Parse(envBuildFile))

func (n *NomadClient) BuildEnvJob(
	t trace.Tracer,
	ctx context.Context,
	envID string,
	// build is used to separate builds of the same env that can start simultaneously. Should be an UUID generated on server.
	buildID string,
	apiSecret string,
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
		attribute.String("env_id", envID),
		attribute.String("build_id", buildID),
		attribute.Int64("disk_size_mb", vmConfig.DiskSizeMB),
		attribute.Int64("vcpu_count", vmConfig.VCpuCount),
		attribute.Int64("memory_mb", vmConfig.MemoryMB),
	)

	var jobDef bytes.Buffer

	jobVars := struct {
		APISecret                  string
		BuildID                    string
		EnvID                      string
		SpanID                     string
		TraceID                    string
		JobName                    string
		TaskName                   string
		EnvsDisk                   string
		GoogleServiceAccountBase64 string
		VCpuCount                  int64
		MemoryMB                   int64
		DiskSizeMB                 int64
	}{
		APISecret:                  apiSecret,
		BuildID:                    buildID,
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
	}

	err := envBuildTemplate.Execute(&jobDef, jobVars)
	if err != nil {
		return fmt.Errorf("failed to `envBuildJobTemp.Execute()`: %w", err)
	}

	job, err := n.client.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return fmt.Errorf("failed to parse the HCL job file %+s: %w", jobDef.String(), err)
	}

	sub := n.newSubscriber(*job.ID, taskDeadState)
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

	case <-sub.wait:
		cleanupErr := n.DeleteEnvBuild(*job.ID, true)
		if cleanupErr != nil {
			errMsg := fmt.Errorf("error in cleanup after failing to create instance of environment '%s': %w", envID, cleanupErr)
			telemetry.ReportError(childCtx, errMsg)
		} else {
			telemetry.ReportEvent(childCtx, "cleaned up env build job", attribute.String("env_id", envID))
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

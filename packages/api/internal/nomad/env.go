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
)

const (
	envsDisk = "/mnt/disks/fc-envs/v1"

	buildJobName          = "env-build"
	buildJobNameWithSlash = buildJobName + "/"

	defaultVCpuCount  = 2
	defaultMemoryMB   = 512
	defaultDiskSizeMB = 512

	buildFinishTimeout = time.Minute * 30
)

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
) error {
	childCtx, childSpan := t.Start(ctx, "build-env-job",
		trace.WithAttributes(
			attribute.String("env_id", envID),
		),
	)
	defer childSpan.End()

	traceID := childSpan.SpanContext().TraceID().String()
	spanID := childSpan.SpanContext().SpanID().String()

	childSpan.SetAttributes(
		attribute.String("passed_trace_id_hex", traceID),
		attribute.String("passed_span_id_hex", spanID),
	)

	var jobDef bytes.Buffer

	jobVars := struct {
		APISecret  string
		BuildID    string
		EnvID      string
		SpanID     string
		TraceID    string
		JobName    string
		TaskName   string
		EnvsDisk   string
		VCpuCount  int
		MemoryMB   int
		DiskSizeMB int
	}{
		APISecret:  apiSecret,
		BuildID:    buildID,
		SpanID:     spanID,
		DiskSizeMB: defaultDiskSizeMB,
		VCpuCount:  defaultVCpuCount,
		MemoryMB:   defaultMemoryMB,
		TraceID:    traceID,
		EnvID:      envID,
		TaskName:   defaultTaskName,
		JobName:    buildJobName,
		EnvsDisk:   envsDisk,
	}

	err := envBuildTemplate.Execute(&jobDef, jobVars)
	if err != nil {
		return fmt.Errorf("failed to `envBuildJobTemp.Execute()`: %w", err)
	}

	job, err := n.client.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return fmt.Errorf("failed to parse the HCL job file %+s: %w", jobDef.String(), err)
	}

	result := make(chan AllocResult)
	defer close(result)

	waitCtx, cancel := context.WithTimeout(childCtx, buildFinishTimeout)
	defer cancel()

	go n.WaitForJob(waitCtx, *job.ID, taskDeadState, result)

	_, _, err = n.client.Jobs().Register(job, nil)
	if err != nil {
		return fmt.Errorf("failed to register '%s%s' job: %w", buildJobNameWithSlash, jobVars.EnvID, err)
	}

	finishErr := <-result
	if finishErr.Err != nil {
		return fmt.Errorf("error waiting for env '%s' build: %w", envID, finishErr.Err)
	}

	delErr := n.DeleteEnvBuild(*job.ID, false)
	if delErr != nil {
		return fmt.Errorf("error in cleanup after failing to create instance of environment '%s': %w", envID, delErr)
	}

	return nil
}

func (n *NomadClient) DeleteEnvBuild(jobID string, purge bool) error {
	_, _, err := n.client.Jobs().Deregister(jobID, purge, nil)
	if err != nil {
		return fmt.Errorf("cannot delete job '%s%s' job: %w", buildJobNameWithSlash, jobID, err)
	}

	return nil
}

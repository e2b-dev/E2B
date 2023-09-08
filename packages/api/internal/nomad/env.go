package nomad

import (
	// trunk-ignore(semgrep/go.lang.security.audit.xss.import-text-template.import-text-template)
	"bytes"
	_ "embed"
	"fmt"
	"path"
	"text/template"
)

//go:embed base.Dockerfile
var baseDockerfile string

const (
	buildEnvJobName = "fc-build-envs"
	buildEnvJobFile = buildEnvJobName + jobFileSuffix

	deleteEnvJobName = "fc-delete-envs"
	deleteEnvJobFile = deleteEnvJobName + jobFileSuffix
)

func (n *NomadClient) DeleteEnv(envID string) error {
	tempName := path.Join(templatesDir, deleteEnvJobFile)

	temp, err := template.ParseFiles(tempName)
	if err != nil {
		return fmt.Errorf("failed to parse template file '%s': %+v", tempName, err)
	}

	temp = template.Must(temp, err)

	tempVars := struct {
		CodeSnippetID string
		FCEnvsDisk    string
		JobName       string
	}{
		JobName:       deleteEnvJobName,
		CodeSnippetID: envID,
		FCEnvsDisk:    fcEnvsDisk,
	}

	var spec bytes.Buffer
	if tempErr := temp.Execute(&spec, tempVars); tempErr != nil {
		return fmt.Errorf("failed to `temp.Execute()`: %+v", tempErr)
	}

	job, err := n.client.Jobs().ParseHCL(spec.String(), false)
	if err != nil {
		return fmt.Errorf("failed to parse template '%s': %+v", tempName, err)
	}

	_, _, err = n.client.Jobs().Register(job, nil)
	if err != nil {
		return fmt.Errorf("failed to register '%s/%s' job: %+v", deleteEnvJobName, tempVars.CodeSnippetID, err)
	}

	return nil
}

func (n *NomadClient) BuildEnv(codeSnippetID string, envTemplate string) (*JobInfo, error) {
	dockerfileName := fmt.Sprintf("%s.Dockerfile", envTemplate)
	tname := path.Join(templatesDir, envTemplatesDir, dockerfileName)

	dockerfileTemp, err := template.ParseFiles(tname)
	if err != nil {
		return nil, fmt.Errorf("failed to parse template file '%s': %+v", tname, err)
	}

	dockerfileTemp = template.Must(dockerfileTemp, err)
	dockerfileVars := struct {
		BaseDockerfile string
	}{
		BaseDockerfile: baseDockerfile,
	}

	var dockerfile bytes.Buffer
	if tempErr := dockerfileTemp.Execute(&dockerfile, dockerfileVars); tempErr != nil {
		return nil, fmt.Errorf("failed to `dockerfileTemp.Execute()`: %+v", tempErr)
	}

	tname = path.Join(templatesDir, buildEnvJobFile)

	envsJobTemp, err := template.New(buildEnvJobFile).Funcs(
		template.FuncMap{
			"escapeHCL": escapeHCL,
		},
	).ParseFiles(tname)
	if err != nil {
		return nil, fmt.Errorf("failed to parse template file '%s': %+v", tname, err)
	}

	envsJobTemp = template.Must(envsJobTemp, err)

	jobVars := struct {
		CodeSnippetID string
		Dockerfile    string
		FCEnvsDisk    string
		JobName       string
	}{
		CodeSnippetID: codeSnippetID,
		Dockerfile:    dockerfile.String(),
		FCEnvsDisk:    fcEnvsDisk,
		JobName:       buildEnvJobName,
	}

	var jobDef bytes.Buffer
	if jobErr := envsJobTemp.Execute(&jobDef, jobVars); jobErr != nil {
		return nil, fmt.Errorf("failed to `envsJobTemp.Execute()`: %+v", jobErr)
	}

	job, err := n.client.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return nil, fmt.Errorf("failed to parse the `%s` HCL job file: %+v", buildEnvJobName, err)
	}

	jobResponse, _, err := n.client.Jobs().Register(job, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to register '%s/%s' job: %+v", buildEnvJobName, jobVars.CodeSnippetID, err)
	}

	return &JobInfo{
		name:   *job.Name,
		evalID: jobResponse.EvalID,
		index:  0,
	}, nil
}

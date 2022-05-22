package nomad

import (
	"bytes"
	"fmt"
	"path"
	"text/template"

	"github.com/hashicorp/nomad/api"
)

//func (n *Nomad) CreateEnvironment(codeSnippetID, dockerfile string) (*api.JobDispatchResponse, *api.WriteMeta, error) {
func (n *NomadClient) RegisterFCEnvJob(codeSnippetID, envTemplate string, deps []string) (string, error) {
	dockerfileName := fmt.Sprintf("%s.Dockerfile", envTemplate)
	tname := path.Join(templatesDir, "env-templates", dockerfileName)
	dockerfileTemp, err := template.ParseFiles(tname)
	if err != nil {
		return "", fmt.Errorf("Failed to parse template file '%s': %s", tname, err)
	}

	dockerfileTemp = template.Must(dockerfileTemp, err)

	dockerfileVars := struct {
		Deps []string
	}{
		Deps: deps,
	}
	var dockerfile bytes.Buffer
	if err := dockerfileTemp.Execute(&dockerfile, dockerfileVars); err != nil {
		return "", fmt.Errorf("Failed to `dockerfileTemp.Execute()`: %s", err)
	}

	tname = path.Join(templatesDir, "firecracker-envs.hcl")
	envsJobTemp, err := template.New("firecracker-envs.hcl").Funcs(
		template.FuncMap{
			"escapeNewLines": escapeNewLines,
		},
	).ParseFiles(tname)
	if err != nil {
		return "", fmt.Errorf("Failed to parse template file '%s': %s", tname, err)
	}

	envsJobTemp = template.Must(envsJobTemp, err)

	jobVars := struct {
		CodeSnippetID string
		Dockerfile    string
	}{
		CodeSnippetID: codeSnippetID,
		Dockerfile:    dockerfile.String(),
	}
	var jobDef bytes.Buffer
	if err := envsJobTemp.Execute(&jobDef, jobVars); err != nil {
		return "", fmt.Errorf("Failed to `envsJobTemp.Execute()`: %s", err)
	}

	job, err := n.client.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return "", fmt.Errorf("Failed to parse the `firecracker-envs` HCL job file: %s", err)
	}

	res, _, err := n.client.Jobs().Register(job, &api.WriteOptions{})
	if err != nil {
		return "", fmt.Errorf("Failed to register 'firecracker-envs/%s' job: %s", jobVars.CodeSnippetID, err)
	}

	return res.EvalID, nil
}

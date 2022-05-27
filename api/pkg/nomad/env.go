package nomad

import (
	"bytes"
	"fmt"
	"path"
	"text/template"

	"github.com/hashicorp/nomad/api"
)

const (
  baseDockerfile = `
FROM alpine:3.14

RUN apk add --update util-linux openrc openssh

COPY devbookd /usr/bin/devbookd
COPY devbookd-init /etc/init.d/devbookd
COPY provision-env.sh provision-env.sh
RUN chmod +x provision-env.sh`
)

func (n *NomadClient) RegisterFCEnvDeleterJob(codeSnippetID string) error {
  tempName := path.Join(templatesDir, "firecracker-env-deleters.hcl")
  temp, err := template.ParseFiles(tempName)
	if err != nil {
		return fmt.Errorf("Failed to parse template file '%s': %s", tempName, err)
	}
  temp = template.Must(temp, err)

  tempVars := struct {
    CodeSnippetID string
		FCEnvsDisk    string
  }{
    CodeSnippetID: codeSnippetID,
    FCEnvsDisk: fcEnvsDisk,
  }
  var spec bytes.Buffer
  if err := temp.Execute(&spec, tempVars); err != nil {
    return fmt.Errorf("Failed to `temp.Execute()`: %s", err)
  }

  job, err := n.client.Jobs().ParseHCL(spec.String(), false)
  if err != nil {
    return fmt.Errorf("Failed to parse template '%s': %s", tempName, err)
  }

	_, _, err = n.client.Jobs().Register(job, &api.WriteOptions{})
	if err != nil {
		return fmt.Errorf("Failed to register 'firecracker-env-deleters/%s' job: %s", tempVars.CodeSnippetID, err)
	}

  return nil
}

func (n *NomadClient) RegisterFCEnvJob(codeSnippetID, envTemplate string, deps []string) error {
	dockerfileName := fmt.Sprintf("%s.Dockerfile", envTemplate)
	tname := path.Join(templatesDir, "env-templates", dockerfileName)
	dockerfileTemp, err := template.ParseFiles(tname)
	if err != nil {
		return fmt.Errorf("Failed to parse template file '%s': %s", tname, err)
	}

	dockerfileTemp = template.Must(dockerfileTemp, err)

	dockerfileVars := struct {
		Deps            []string
    BaseDockerfile  string
	}{
		Deps:           deps,
    BaseDockerfile: baseDockerfile,
	}
	var dockerfile bytes.Buffer
	if err := dockerfileTemp.Execute(&dockerfile, dockerfileVars); err != nil {
		return fmt.Errorf("Failed to `dockerfileTemp.Execute()`: %s", err)
	}

	tname = path.Join(templatesDir, "firecracker-envs.hcl")
	envsJobTemp, err := template.New("firecracker-envs.hcl").Funcs(
		template.FuncMap{
			"escapeHCL": escapeHCL,
		},
	).ParseFiles(tname)
	if err != nil {
		return fmt.Errorf("Failed to parse template file '%s': %s", tname, err)
	}

	envsJobTemp = template.Must(envsJobTemp, err)

	jobVars := struct {
		CodeSnippetID string
		Dockerfile    string
		FCEnvsDisk    string
	}{
		CodeSnippetID: codeSnippetID,
		Dockerfile:    dockerfile.String(),
		FCEnvsDisk:    fcEnvsDisk,
	}
	var jobDef bytes.Buffer
	if err := envsJobTemp.Execute(&jobDef, jobVars); err != nil {
		return fmt.Errorf("Failed to `envsJobTemp.Execute()`: %s", err)
	}

	job, err := n.client.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return fmt.Errorf("Failed to parse the `firecracker-envs` HCL job file: %s", err)
	}

	_, _, err = n.client.Jobs().Register(job, &api.WriteOptions{})
	if err != nil {
		return fmt.Errorf("Failed to register 'firecracker-envs/%s' job: %s", jobVars.CodeSnippetID, err)
	}

	return nil
}

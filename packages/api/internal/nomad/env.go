package nomad

import (
	"bytes"
	"fmt"
	"path"
	"text/template"
	"time"

	"github.com/devbookhq/devbook-api/packages/api/internal/api"
	nomadAPI "github.com/hashicorp/nomad/api"
)

const (
	baseDockerfile = `
FROM alpine:3.16

RUN apk update && apk upgrade
RUN apk add --no-cache util-linux openrc openssh socat chrony

COPY ./devbookd /usr/bin/devbookd
RUN chmod +x /usr/bin/devbookd
COPY alpine/devbookd-init /etc/init.d/devbookd

COPY alpine/rc-mount /etc/local.d/rc-mount.start
RUN chmod +x /etc/local.d/rc-mount.start

RUN mkdir -p /etc/chrony
RUN echo "refclock PHC /dev/ptp0 poll 3 dpoll -2 offset 0" > /etc/chrony/chrony.conf
RUN echo "makestep 1 -1" >> /etc/chrony/chrony.conf

COPY alpine/provision-env.alpine.sh /provision-env.sh
RUN chmod +x /provision-env.sh`

	buildEnvJobName = "fc-build-envs"
	buildEnvJobFile = buildEnvJobName + jobFileSuffix

	updateEnvJobName = "fc-update-envs"
	updateEnvJobFile = updateEnvJobName + jobFileSuffix

	deleteEnvJobName = "fc-delete-envs"
	deleteEnvJobFile = deleteEnvJobName + jobFileSuffix

	usePrebuiltEnvJobName = "fc-use-prebuilt-envs"
	usePrebuiltEnvJobFile = usePrebuiltEnvJobName + jobFileSuffix

	nomadEvaluationCompleteState = "complete"
	allocationCheckInterval      = time.Millisecond * 100
)

func (n *NomadClient) DeleteEnv(codeSnippetID string) error {
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
		CodeSnippetID: codeSnippetID,
		FCEnvsDisk:    fcEnvsDisk,
	}
	var spec bytes.Buffer
	if err := temp.Execute(&spec, tempVars); err != nil {
		return fmt.Errorf("failed to `temp.Execute()`: %+v", err)
	}

	job, err := n.client.Jobs().ParseHCL(spec.String(), false)
	if err != nil {
		return fmt.Errorf("failed to parse template '%s': %+v", tempName, err)
	}

	_, _, err = n.client.Jobs().Register(job, &nomadAPI.WriteOptions{})
	if err != nil {
		return fmt.Errorf("failed to register '%s/%s' job: %+v", deleteEnvJobName, tempVars.CodeSnippetID, err)
	}

	return nil
}

func (n *NomadClient) UsePrebuiltEnv(codeSnippetID string, envTemplate string, callback func(err *error)) error {
	tname := path.Join(templatesDir, usePrebuiltEnvJobFile)
	envsJobTemp, err := template.New(usePrebuiltEnvJobFile).ParseFiles(tname)
	if err != nil {
		return fmt.Errorf("failed to parse template file '%s': %+v", tname, err)
	}

	envsJobTemp = template.Must(envsJobTemp, err)

	jobVars := struct {
		CodeSnippetID string
		FCEnvsDisk    string
		JobName       string
		APIKey        string
		Template      string
	}{
		CodeSnippetID: codeSnippetID,
		FCEnvsDisk:    fcEnvsDisk,
		JobName:       usePrebuiltEnvJobName,
		APIKey:        api.APIAdminKey,
		Template:      envTemplate,
	}

	var jobDef bytes.Buffer
	if err := envsJobTemp.Execute(&jobDef, jobVars); err != nil {
		return fmt.Errorf("failed to `envsJobTemp.Execute()`: %+v", err)
	}

	job, err := n.client.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return fmt.Errorf("failed to parse the `%s` HCL job file: %+v", usePrebuiltEnvJobName, err)
	}

	registeredJob, _, err := n.client.Jobs().Register(job, &nomadAPI.WriteOptions{})
	if err != nil {
		return fmt.Errorf("failed to register '%s/%s' job: %+v", usePrebuiltEnvJobName, jobVars.CodeSnippetID, err)
	}

	go func() {
		timeout := time.After(allocationCheckTimeout)

	allocationCheck:
		for {
			select {
			case <-timeout:
				break allocationCheck
			default:
				eval, _, err := n.client.Evaluations().Info(registeredJob.EvalID, &nomadAPI.QueryOptions{})
				if err != nil {
					callbackError := fmt.Errorf("cannot retrieve evaluation for '%s/%s' job: %+v", usePrebuiltEnvJobName, codeSnippetID, err)
					callback(&callbackError)
					return
				}

				if eval.Status == nomadEvaluationCompleteState {
					callback(nil)
					return
				}
			}
			time.Sleep(allocationCheckInterval)
		}

		callbackError := fmt.Errorf("cannot retrieve allocations for '%s/%s' job: %+v", usePrebuiltEnvJobName, codeSnippetID, err)
		callback(&callbackError)
	}()

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
	if err := dockerfileTemp.Execute(&dockerfile, dockerfileVars); err != nil {
		return nil, fmt.Errorf("failed to `dockerfileTemp.Execute()`: %+v", err)
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
		APIKey        string
		JobName       string
	}{
		CodeSnippetID: codeSnippetID,
		Dockerfile:    dockerfile.String(),
		FCEnvsDisk:    fcEnvsDisk,
		JobName:       buildEnvJobName,
		APIKey:        api.APIAdminKey,
	}

	var jobDef bytes.Buffer
	if err := envsJobTemp.Execute(&jobDef, jobVars); err != nil {
		return nil, fmt.Errorf("failed to `envsJobTemp.Execute()`: %+v", err)
	}

	job, err := n.client.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return nil, fmt.Errorf("failed to parse the `%s` HCL job file: %+v", buildEnvJobName, err)
	}

	jobResponse, _, err := n.client.Jobs().Register(job, &nomadAPI.WriteOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to register '%s/%s' job: %+v", buildEnvJobName, jobVars.CodeSnippetID, err)
	}

	return &JobInfo{
		name:   *job.Name,
		evalID: jobResponse.EvalID,
		index:  0,
	}, nil
}

func (n *NomadClient) UpdateEnv(codeSnippetID string, session *api.Session) error {
	tname := path.Join(templatesDir, updateEnvJobFile)
	envsJobTemp, err := template.New(updateEnvJobFile).ParseFiles(tname)
	if err != nil {
		return fmt.Errorf("failed to parse template file '%s': %+v", tname, err)
	}

	envsJobTemp = template.Must(envsJobTemp, err)

	var sessionID string
	if session != nil {
		sessionID = session.SessionID
	} else {
		sessionID = ""
	}

	jobVars := struct {
		CodeSnippetID string
		FCEnvsDisk    string
		JobName       string
		SessionID     string
		APIKey        string
	}{
		CodeSnippetID: codeSnippetID,
		FCEnvsDisk:    fcEnvsDisk,
		JobName:       updateEnvJobName,
		SessionID:     sessionID,
		APIKey:        api.APIAdminKey,
	}

	var jobDef bytes.Buffer
	if err := envsJobTemp.Execute(&jobDef, jobVars); err != nil {
		return fmt.Errorf("failed to `envsJobTemp.Execute()`: %+v", err)
	}

	job, err := n.client.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return fmt.Errorf("failed to parse the `%s` HCL job file: %+v", updateEnvJobName, err)
	}

	_, _, err = n.client.Jobs().Register(job, &nomadAPI.WriteOptions{})
	if err != nil {
		return fmt.Errorf("failed to register '%s/%s' job: %+v", updateEnvJobName, jobVars.CodeSnippetID, err)
	}

	// TODO: Add callback on job finish

	return nil
}

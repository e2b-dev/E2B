package nomad

import (
  "bytes"
  "fmt"
  "path"
  //"os"
  "strings"
  "text/template"
  "github.com/hashicorp/nomad/api"
)

const (
  templatesDir = "templates"
)

func escapeNewLines(input string) string {
  str := strings.Replace(input, "\n", "\\\\n", -1)
  fmt.Println(str)
  return str
}

//func (n *Nomad) CreateEnvironment(codeSnippetID, dockerfile string) (*api.JobDispatchResponse, *api.WriteMeta, error) {
func (n *Nomad) RegisterFCEnvJob(codeSnippetID, runtime string) (string, error) {
  dockerfileName := fmt.Sprintf("%s.Dockerfile", runtime)
  tname := path.Join(templatesDir, "runtimes", dockerfileName)
  dockerfileTemp, err := template.ParseFiles(tname)
  if err != nil {
    return "", fmt.Errorf("Failed to parse template file '%s': %s", tname, err)
  }

  dockerfileTemp = template.Must(dockerfileTemp, err)

  var dockerfile bytes.Buffer
  if err := dockerfileTemp.Execute(&dockerfile, struct{}{}); err != nil {
    return "", fmt.Errorf("Failed to `dockerfileTemp.Execute()`: %s", err)
  }

  jobVars := struct{
    CodeSnippetID string
    Dockerfile    string
  }{
    CodeSnippetID:  codeSnippetID,
    Dockerfile:     dockerfile.String(),
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

  fmt.Println(envsJobTemp)
  envsJobTemp = template.Must(envsJobTemp, err)

  var jobDef bytes.Buffer
  if err := envsJobTemp.Execute(&jobDef, jobVars); err != nil {
    return "", fmt.Errorf("Failed to `envsJobTemp.Execute()`: %s", err)
  }
  fmt.Println(jobDef.String())





  job, err := n.nomadClient.Jobs().ParseHCL(jobDef.String(), false)
  if err != nil {
    return "", fmt.Errorf("Failed to parse the `firecracker-envs` HCL job file: %s", err)
  }

  res, _, err := n.nomadClient.Jobs().Register(job, &api.WriteOptions{})
  if err != nil {
    return "", fmt.Errorf("Failed to register 'firecracker-envs/%s' job: %s", jobVars.CodeSnippetID, err)
  }

  return res.EvalID, nil
}

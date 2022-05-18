package nomad

import (
  "bytes"
  "fmt"
  //"os"
  "text/template"
  "github.com/hashicorp/nomad/api"
)

const envSessionID = "firecracker-envs"


//func (n *Nomad) CreateEnvironment(codeSnippetID, dockerfile string) (*api.JobDispatchResponse, *api.WriteMeta, error) {
func (n *Nomad) CreateEnvironment(codeSnippetID, dockerfile string) {
  //params := map[string]string{
  //  "CODE_SNIPPET_ID": codeSnippetID,
  //  "DOCKERFILE": dockerfile,
  //}
  //return n.nomadClient.Jobs().Dispatch(envSessionID, params, nil, &api.WriteOptions{})

  temp := template.Must(template.ParseFiles("./templates/firecracker-envs.hcl"))


  var jobDef bytes.Buffer
  if err := temp.Execute(&jobDef, struct{
    CodeSnippetID string
    Dockerfile string
  }{
    CodeSnippetID: codeSnippetID,
    Dockerfile: dockerfile,
  }); err != nil {
      panic(err)
  }

  fmt.Println(jobDef.String())

  job, err := n.nomadClient.Jobs().ParseHCL(jobDef.String(), false)
  if err != nil {
    panic(err)
  }
  res, _, err := n.nomadClient.Jobs().Register(job, &api.WriteOptions{})
  if err != nil {
    panic(err)
  }
  fmt.Println(res.EvalID)



  //name := "firecracker-envs"
  //id := fmt.Sprintf("%s/%s", name, codeSnippetID)
  //region := "global"
  //priority := 50
  //j := n.nomadClient.Jobs().NewBatchJob(id, name, region, priority)

  //evalID := n.nomadClient.Jobs().Register(j, &api.WriteOptions)


}

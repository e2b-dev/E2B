package nomad

import (
  "github.com/hashicorp/nomad/api"
)

const envSessionID = "firecracker-envs"

func (n *Nomad) CreateEnvironment(codeSnippetID, dockerfile string) (*api.JobDispatchResponse, *api.WriteMeta, error){
  params := map[string]string{
    "CODE_SNIPPET_ID": codeSnippetID,
    "DOCKERFILE": dockerfile,
  }
  return n.nomadClient.Jobs().Dispatch(envSessionID, params, nil, &api.WriteOptions{})
}

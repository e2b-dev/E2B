package nomad

import "github.com/hashicorp/nomad/api"

func (n *Nomad) CreateSession(jobID string) (*api.JobDispatchResponse, *api.WriteMeta, error) {
	return n.nomadClient.Jobs().Dispatch(jobID, nil, nil, &api.WriteOptions{})
}

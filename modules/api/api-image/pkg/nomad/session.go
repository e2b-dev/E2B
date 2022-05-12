package nomad

import (
  "github.com/hashicorp/nomad/api"
)

func (n *Nomad) CreateSession(jobID string) (*api.JobDispatchResponse, *api.WriteMeta, error) {
	return n.nomadClient.Jobs().Dispatch(jobID, nil, nil, &api.WriteOptions{})
}

func (n *Nomad) DeleteSession(jobID string) (string, *api.WriteMeta, error) {
	return n.nomadClient.Jobs().Deregister(jobID, false, &api.WriteOptions{})
}

func (n *Nomad) GetSessions(jobID string) ([]*api.JobListStub, *api.QueryMeta, error) {
	return n.nomadClient.Jobs().PrefixList(jobID)
}


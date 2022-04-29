package nomad

import "github.com/hashicorp/nomad/api"

func (n *Nomad) GetSessions(jobID string) ([]*api.JobListStub, *api.QueryMeta, error) {
	return n.nomadClient.Jobs().PrefixList(jobID)
}

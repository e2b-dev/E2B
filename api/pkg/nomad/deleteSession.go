package nomad

import "github.com/hashicorp/nomad/api"

func (n *Nomad) DeleteSession(jobID string) (string, *api.WriteMeta, error) {
	return n.nomadClient.Jobs().Deregister(jobID, false, &api.WriteOptions{})
}

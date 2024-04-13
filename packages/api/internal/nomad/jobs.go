package nomad

import (
	"github.com/e2b-dev/infra/packages/api/internal/utils"

	"github.com/hashicorp/nomad/api"
)

const (
	taskRunningState = "running"
	taskDeadState    = "dead"
	taskPendingState = "pending"

	jobRunningStatus = "running"

	defaultTaskName = "start"
)

const (
	InstanceIDPrefix = "i"
)

type jobSubscriber struct {
	subscribers *utils.Map[*jobSubscriber]
	wait        chan api.Allocation
	jobID       string
	taskState   string
	taskName    string
}

func (s *jobSubscriber) close() {
	s.subscribers.Remove(s.jobID)
}

func (n *NomadClient) newSubscriber(jobID, taskState, taskName string) *jobSubscriber {
	sub := &jobSubscriber{
		jobID:       jobID,
		wait:        make(chan api.Allocation),
		taskState:   taskState,
		subscribers: n.subscribers,
		taskName:    taskName,
	}

	n.subscribers.Insert(jobID, sub)

	return sub
}

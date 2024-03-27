package nomad

import (
	"context"
	"fmt"
	"os"

	"github.com/e2b-dev/infra/packages/api/internal/utils"

	"github.com/hashicorp/nomad/api"
)

const (
	shortNodeIDLength = 8

	taskRunningState = "running"
	taskDeadState    = "dead"
	taskPendingState = "pending"

	jobRunningStatus = "running"

	defaultTaskName = "start"
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

func (n *NomadClient) GetStartingIndex(ctx context.Context) (uint64, error) {
	_, meta, err := n.client.Jobs().List(nil)
	if err != nil {
		return 0, fmt.Errorf("failed to get Nomad jobs: %w", err)
	}

	return meta.LastIndex, nil
}

func (n *NomadClient) ListenToJobs(ctx context.Context, index uint64) error {
	topics := map[api.Topic][]string{
		api.TopicAllocation: {"*"},
	}

	streamCtx, streamCancel := context.WithCancel(ctx)
	defer streamCancel()

	eventCh, err := n.client.EventStream().Stream(streamCtx, topics, index, &api.QueryOptions{
		Filter:     fmt.Sprintf("JobID contains \"%s\"", instanceJobNameWithSlash),
		AllowStale: true,
		Prefix:     instanceJobNameWithSlash,
	})
	if err != nil {
		return fmt.Errorf("failed to get Nomad event stream: %w", err)
	}

	for event := range eventCh {
		if event.IsHeartbeat() {
			continue
		}

		for _, e := range event.Events {
			alloc, allocErr := e.Allocation()
			if allocErr != nil {
				errMsg := fmt.Errorf("cannot retrieve allocations for '%s' job: %w", alloc.JobID, allocErr)
				fmt.Fprint(os.Stderr, errMsg.Error())

				continue
			}

			n.processAlloc(alloc)
		}
	}

	return nil
}

func (n *NomadClient) newSubscriber(jobID, taskState, taskName string) *jobSubscriber {
	sub := &jobSubscriber{
		jobID: jobID,
		// We add arbitrary buffer to the channel to avoid blocking the Nomad ListenToJobs goroutine
		wait:        make(chan api.Allocation, 10),
		taskState:   taskState,
		subscribers: n.subscribers,
		taskName:    taskName,
	}

	n.subscribers.Insert(jobID, sub)

	return sub
}

func (n *NomadClient) processAlloc(alloc *api.Allocation) {
	sub, ok := n.subscribers.Get(alloc.JobID)

	if !ok {
		return
	}

	taskName := sub.taskName

	if alloc.TaskStates == nil {
		return
	}

	if sub.taskState == taskRunningState {
		select {
		case sub.wait <- *alloc:
		default:
			n.logger.Errorf("channel for job %s is full", alloc.JobID)
		}
	}

	if alloc.TaskStates[taskName] == nil {
		return
	}

	switch alloc.TaskStates[taskName].State {
	case taskRunningState:
		if sub.taskState != taskRunningState {
			break
		}

		fallthrough
	case taskDeadState:
		select {
		case sub.wait <- *alloc:
		default:
			n.logger.Errorf("channel for job %s is full", alloc.JobID)
		}
	}
}

package nomad

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

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

	jobCheckInterval = 100 * time.Millisecond
)

type jobSubscriber struct {
	subscribers *utils.Map[*jobSubscriber]
	wait        chan api.AllocationListStub
	jobID       string
	taskState   string
	taskName    string
}

func (s *jobSubscriber) close() {
	s.subscribers.Remove(s.jobID)
}

func (n *NomadClient) newSubscriber(jobID, taskState, taskName string) *jobSubscriber {
	sub := &jobSubscriber{
		jobID: jobID,
		// We add arbitrary buffer to the channel to avoid blocking the Nomad ListenToJobs goroutine
		wait:        make(chan api.AllocationListStub, 10),
		taskState:   taskState,
		subscribers: n.subscribers,
		taskName:    taskName,
	}

	n.subscribers.Insert(jobID, sub)

	return sub
}

func (n *NomadClient) ListenToJobs(ctx context.Context) {
	ticker := time.NewTicker(jobCheckInterval)
	defer ticker.Stop()

	for {
		select {
		// Loop with a ticker work differently than a loop with sleep.
		// The ticker will tick every 100ms, but if the loop takes more than 100ms to run, the ticker will tick again immediately.
		case <-ticker.C:
			subscribers := n.subscribers.Items()

			if len(subscribers) == 0 {
				continue
			}

			filterParts := make([]string, len(subscribers))

			var i int

			for jobID := range subscribers {
				filterParts[i] = jobID
				i++
			}

			filterString := strings.Join(filterParts, "|")

			allocs, _, err := n.client.Allocations().List(&api.QueryOptions{
				Filter: fmt.Sprintf("JobID matches \"%s\"", filterString),
			})
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error getting jobs: %v\n", err)

				return
			}

			for _, alloc := range allocs {
				n.processAllocs(alloc)
			}

		case <-ctx.Done():
			fmt.Println("Context canceled, stopping ListenToJobs")

			return
		}
	}
}

func (n *NomadClient) processAllocs(alloc *api.AllocationListStub) {
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
			fmt.Fprintf(os.Stderr, "channel for job %s is full\n", alloc.JobID)
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
			fmt.Fprintf(os.Stderr, "channel for job %s is full\n", alloc.JobID)
		}
	}
}

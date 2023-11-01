package nomad

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/hashicorp/nomad/api"
)

const (
	shortNodeIDLength = 8

	taskRunningState = "running"
	taskDeadState    = "dead"

	defaultTaskName = "start"

	jobCheckInterval = 100 * time.Millisecond

	pageSize = 100
)

var allowedSubscriptionJobs = []string{
	buildJobNameWithSlash,
	instanceJobNameWithSlash,
}

type jobSubscriber struct {
	subscribers *utils.Map[*jobSubscriber]
	wait        chan api.AllocationListStub
	jobID       string
	taskState   string
}

func (s *jobSubscriber) close() {
	close(s.wait)
	s.subscribers.Remove(s.jobID)
}

func (n *NomadClient) newSubscriber(jobID string, taskState string) *jobSubscriber {
	sub := &jobSubscriber{
		jobID:       jobID,
		wait:        make(chan api.AllocationListStub),
		taskState:   taskState,
		subscribers: n.subscribers,
	}

	n.subscribers.Insert(jobID, sub)

	return sub
}

func (n *NomadClient) ListenToJobs(ctx context.Context) {
	ticker := time.NewTicker(jobCheckInterval)
	defer ticker.Stop()

	filterParts := make([]string, len(allowedSubscriptionJobs))

	for i, job := range allowedSubscriptionJobs {
		filterParts[i] = fmt.Sprintf("JobID contains \"%s\"", job)
	}

	filterString := strings.Join(filterParts, " or ")

	for {
		select {
		// Loop with a ticker work differently than a loop with sleep.
		// The ticker will tick every 100ms, but if the loop takes more than 100ms to run, the ticker will tick again immediately.
		case <-ticker.C:
			var nextToken string

			var isLastPage bool

			for !isLastPage {
				allocs, meta, err := n.client.Allocations().List(&api.QueryOptions{
					Filter:    filterString,
					NextToken: nextToken,
					PerPage:   pageSize,
				})
				if err != nil {
					log.Printf("Error getting jobs: %v\n", err)

					return
				}

				if nextToken == "" {
					isLastPage = true
				}

				nextToken = meta.NextToken

				for _, alloc := range allocs {
					n.processAllocs(alloc)
				}
			}

		case <-ctx.Done():
			log.Println("Context canceled, stopping ListenToJobs")

			return
		}
	}
}

func (n *NomadClient) processAllocs(alloc *api.AllocationListStub) {
	sub, ok := n.subscribers.Get(alloc.JobID)
	if !ok {
		return
	}

	if alloc.TaskStates == nil {
		return
	}

	if sub.taskState == taskRunningState {
		sub.wait <- *alloc
	}

	if alloc.TaskStates[defaultTaskName] == nil {
		return
	}

	switch alloc.TaskStates[defaultTaskName].State {
	case taskRunningState:
		if sub.taskState != taskRunningState {
			break
		}

		fallthrough
	case taskDeadState:
		sub.wait <- *alloc
	}
}

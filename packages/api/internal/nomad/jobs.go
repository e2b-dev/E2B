package nomad

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

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

type AllocResult struct {
	Alloc *api.AllocationListStub
	Err   error
}

type jobSubscriber struct {
	jobID     string
	events    chan api.AllocationListStub
	taskState string
}

func (n *NomadClient) newSubscriber(jobID string, taskState string) *jobSubscriber {
	sub := &jobSubscriber{
		jobID:     jobID,
		events:    make(chan api.AllocationListStub),
		taskState: taskState,
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
		sub.events <- *alloc
	}
}

func (n *NomadClient) WaitForJob(ctx context.Context, jobID, taskState string, result chan AllocResult, timeout time.Duration) {
	childCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	sub := n.newSubscriber(jobID, taskState)

	defer n.subscribers.Remove(jobID)
	defer close(sub.events)

	select {
	case alloc := <-sub.events:
		result <- AllocResult{
			Err:   nil,
			Alloc: &alloc,
		}

	case <-childCtx.Done():
		result <- AllocResult{
			Err:   fmt.Errorf("waiting for job '%s' canceled", jobID),
			Alloc: nil,
		}
	}
}

package nomad

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/hashicorp/nomad/api"
)

const (
	shortNodeIDLength = 8

	taskRunningState = "running"
	taskDeadState    = "dead"

	defaultTaskName = "start"

	jobCheckInterval = 100 * time.Millisecond
)

type AllocResult struct {
	Alloc *api.AllocationListStub
	Err   error
}

type jobSubscriber struct {
	jobID     string
	events    chan AllocResult
	taskState string
}

func (n *NomadClient) newSubscriber(jobID string, taskState string) *jobSubscriber {
	sub := &jobSubscriber{
		jobID:     jobID,
		events:    make(chan AllocResult),
		taskState: taskState,
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
			jobs, _, err := n.client.Jobs().List(nil)
			if err != nil {
				log.Printf("Error getting jobs: %s\n", err)

				return
			}

			for _, job := range jobs {
				procErr := n.processJobEvent(job)
				if procErr != nil {
					log.Printf("error processing job event: %s\n", procErr)

					return
				}
			}
		case <-ctx.Done():
			log.Println("Context canceled, stopping ListenToJobs")

			return
		}
	}
}

func (n *NomadClient) processJobEvent(job *api.JobListStub) error {
	sub, ok := n.subscribers.Get(job.ID)
	if !ok {
		return nil
	}

	switch job.Status {
	case taskRunningState:
		if sub.taskState != taskRunningState {
			break
		}

		fallthrough
	case taskDeadState:
		alloc, allocErr, err := n.getFirstAlloc(job, defaultTaskName, sub.taskState == taskRunningState)
		if err != nil {
			errMsg := fmt.Errorf("error with getting allocation '%s': %w", job.ID, err)

			return errMsg
		}

		if allocErr != nil {
			errMsg := fmt.Errorf("allocation error '%s': %w", job.ID, allocErr)
			sub.events <- AllocResult{
				Alloc: nil,
				Err:   errMsg,
			}

			return nil
		}

		sub.events <- AllocResult{
			Alloc: alloc,
			Err:   nil,
		}
	}

	return nil
}

func (n *NomadClient) getFirstAlloc(job *api.JobListStub, taskName string, running bool) (*api.AllocationListStub, error, error) {
	allocations, _, err := n.client.Jobs().Allocations(job.ID, false, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("error getting allocation for job %s: %w", job.ID, err)
	}

	for _, alloc := range allocations {
		if alloc == nil {
			continue
		}

		if running {
			return alloc, nil, nil
		}

		if alloc.TaskStates[taskName] == nil {
			continue
		}

		if alloc.TaskStates[taskName].State == taskRunningState && running {
			return alloc, nil, nil
		}

		if alloc.TaskStates[taskName].State == taskDeadState {
			if alloc.TaskStates[taskName].Failed {
				return nil, fmt.Errorf("allocation is %s for '%s' job", alloc.TaskStates[taskName].State, job.ID), nil
			} else {
				return alloc, nil, nil
			}
		}
	}

	return nil, nil, fmt.Errorf("no allocation with the task name %s found", taskName)
}

func (n *NomadClient) WaitForJob(ctx context.Context, jobID, taskState string, result chan AllocResult) {
	sub := n.newSubscriber(jobID, taskState)
	defer n.subscribers.Remove(jobID)
	defer close(sub.events)

	select {
	case err := <-sub.events:
		result <- err

	case <-ctx.Done():
		result <- AllocResult{
			Err:   fmt.Errorf("waiting for job '%s' canceled", jobID),
			Alloc: nil,
		}
	}
}

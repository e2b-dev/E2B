package nomad

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/hashicorp/nomad/api"
)

type NomadClient struct {
	client *api.Client
}

func InitNomadClient() *NomadClient {
	config := api.Config{
		Address:  os.Getenv("NOMAD_ADDRESS"),
		SecretID: os.Getenv("NOMAD_TOKEN"),
	}

	client, err := api.NewClient(&config)
	if err != nil {
		log.Fatalf("Error determining current working dir\n> %s\n", err)
	}

	return &NomadClient{
		client: client,
	}
}

func (n *NomadClient) Close() {
	n.client.Close()
}

type JobInfo struct {
	name   string
	evalID string
	index  uint64
}

func (n *NomadClient) WaitForJob(ctx context.Context, job JobInfo, timeout time.Duration, meta api.QueryMeta) (*api.Allocation, error) {
	topics := map[api.Topic][]string{
		api.TopicAllocation: {job.name},
	}

	eventCh, err := n.client.EventStream().Stream(ctx, topics, job.index, &api.QueryOptions{
		Filter:     fmt.Sprintf("EvalID == \"%s\"", job.evalID),
		AllowStale: true,
		WaitIndex:  meta.LastIndex,
		WaitTime:   timeout,
		NextToken:  meta.NextToken,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get Nomad event stream for: %+v", err)
	}

	for event := range eventCh {
		for _, e := range event.Events {
			alloc, err := e.Allocation()
			if err != nil {
				return nil, fmt.Errorf("cannot retrieve allocations for '%s' job: %+v", job.name, err)
			}

			if alloc.TaskStates[fcTaskName] == nil {
				continue
			}

			if alloc.TaskStates[fcTaskName].State == NomadTaskDeadState {
				return nil, fmt.Errorf("allocation is %s for '%s' job", alloc.TaskStates[fcTaskName].State, job.name)
			}

			if alloc.TaskStates[fcTaskName].State == NomadTaskRunningState {
				return alloc, nil
			}
			continue
		}
	}
	return nil, fmt.Errorf("timeout retrieving allocations")
}

func (n *NomadClient) WaitForEnvBuild(job JobInfo, timeout time.Duration) error {
	allocationWait := make(chan error, 1)

	go func() {
		ticker := time.NewTicker(4000 * time.Millisecond)
		for {
			select {
			case <-time.After(timeout):
				allocationWait <- fmt.Errorf("cannot retrieve allocations for '%s' job: Timeout - %s", job.name, timeout.String())
				return
			case <-ticker.C:
				filter := fmt.Sprintf("EvalID == \"%s\"", job.evalID)
				allocations, _, err := n.client.Allocations().List(&api.QueryOptions{
					Filter: filter,
				})
				if err != nil {
					allocationWait <- fmt.Errorf("cannot retrieve allocations from nomad %+v", err)
					return
				}

				for _, alloc := range allocations {
					if alloc.TaskStates[templateTaskName] == nil {
						continue
					}
					if alloc.TaskStates[templateTaskName].State == NomadTaskDeadState {
						if alloc.TaskStates[templateTaskName].Failed {
							allocationWait <- fmt.Errorf("building env failed")
						} else {
							close(allocationWait)
						}
						return
					}
				}
			}
		}
	}()

	return <-allocationWait
}

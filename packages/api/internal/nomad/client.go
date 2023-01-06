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

type allocResult struct {
	alloc *api.Allocation
	err   error
}

type JobInfo struct {
	name   string
	evalID string
	index  uint64
}

func (n *NomadClient) WaitForJob(job JobInfo, timeout time.Duration, nomadDesiredState, nomadFailedState, taskName string) (*api.Allocation, error) {
	ctx := context.Background()

	topics := map[api.Topic][]string{
		api.TopicAllocation: {job.name},
	}

	allocationWait := make(chan *allocResult, 1)
	defer close(allocationWait)

	streamCtx, streamCancel := context.WithCancel(ctx)
	defer streamCancel()

	eventCh, err := n.client.EventStream().Stream(streamCtx, topics, job.index, &api.QueryOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get Nomad event stream for: %+v", err)
	}

	go func() {
		for {
			select {
			case <-time.After(timeout):
				allocationWait <- &allocResult{
					err: fmt.Errorf("cannot retrieve allocations for '%s' job: Timeout - %s", job.name, timeout.String()),
				}
				return
			case <-ctx.Done():
				allocationWait <- &allocResult{
					err: fmt.Errorf("context done"),
				}
				return
			case event := <-eventCh:
				for _, e := range event.Events {
					alloc, err := e.Allocation()

					if err != nil {
						allocationWait <- &allocResult{
							err: fmt.Errorf("cannot retrieve allocations for '%s' job: %+v", job.name, err),
						}
						return
					}

					if alloc.EvalID != job.evalID {
						continue
					}

					fmt.Printf("state %+v\n", alloc.TaskStates)

					if alloc.TaskStates[taskName] == nil {
						continue
					}

					if nomadFailedState != "" {
						if alloc.TaskStates[taskName].State == nomadFailedState {
							allocationWait <- &allocResult{
								err: fmt.Errorf("allocation is %s for '%s' job", alloc.TaskStates[taskName].State, job.name),
							}
							return
						}
					}

					if alloc.TaskStates[taskName].State == nomadDesiredState {
						allocationWait <- &allocResult{
							alloc: alloc,
						}
						return
					}
					continue
				}
			}
		}
	}()

	result := <-allocationWait

	return result.alloc, result.err
}

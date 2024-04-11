package test

import (
	"fmt"
	"github.com/e2b-dev/infra/packages/orchestrator/internal/instance"
	"sync"
	"time"
)

func Run(envID, instanceID *string, keepAlive, count *int) bool {
	if *envID != "" && *instanceID != "" {
		// Start of mock build for testing
		dns, err := instance.NewDNS()
		if err != nil {
			panic(err)
		}

		groupSize := 1

		for i := 0; i < *count; i++ {
			func(in int, envID, instanceID string, count int) {
				var wg sync.WaitGroup

				for j := 0; j < groupSize; j++ {
					wg.Add(1)

					go func(jn int) {
						defer wg.Done()
						id := fmt.Sprintf("%s_%d", instanceID, in+jn*count)
						fmt.Printf("\nSTARTING [%s]\n\n", id)
						instance.MockInstance(envID, id, dns, time.Duration(*keepAlive)*time.Second)
					}(j)
				}

				wg.Wait()
			}(i, *envID, *instanceID, *count)
		}
	} else {
		return false
	}

	return true
}

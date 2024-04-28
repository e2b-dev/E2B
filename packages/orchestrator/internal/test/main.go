package test

import (
	"fmt"
	"sync"
	"time"

	"github.com/e2b-dev/infra/packages/orchestrator/internal/sandbox"
)

func Run(envID, instanceID string, keepAlive, count *int) {
	// Start of mock build for testing
	dns, err := sandbox.NewDNS()
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
					sandbox.MockInstance(envID, id, dns, time.Duration(*keepAlive)*time.Second)
				}(j)
			}

			wg.Wait()
		}(i, envID, instanceID, *count)
	}
}

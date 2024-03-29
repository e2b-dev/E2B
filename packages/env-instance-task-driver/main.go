package main

import (
	"flag"
	"fmt"
	"net/http"
	_ "net/http/pprof"
	"os"
	"sync"
	"time"

	log "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins"

	driver "github.com/e2b-dev/infra/packages/env-instance-task-driver/internal"
	"github.com/e2b-dev/infra/packages/env-instance-task-driver/internal/instance"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

func configurePlugin() {
	// Create pprof endpoint for profiling
	go func() {
		http.ListenAndServe(":6061", nil)
	}()

	shutdown := telemetry.InitOTLPExporter(driver.PluginName, driver.PluginVersion)
	defer shutdown()

	plugins.Serve(factory)
}

func factory(log log.Logger) interface{} {
	return driver.NewPlugin(log)
}

func main() {
	// Create pprof endpoint for profiling
	go func() {
		http.ListenAndServe(":6062", nil)
	}()

	envID := flag.String("env", "", "env id")
	instanceID := flag.String("instance", "", "instance id")
	keepAlive := flag.Int("alive", 0, "keep alive")
	count := flag.Int("count", 1, "number of spawned instances")

	flag.Parse()

	if *envID != "" && *instanceID != "" {
		// Start of mock build for testing
		consulToken := os.Getenv("CONSUL_TOKEN")

		dns, err := instance.NewDNS()
		if err != nil {
			panic(err)
		}

		var wg sync.WaitGroup

		for i := 0; i < *count; i++ {
			wg.Add(1)

			go func(in int, envID, instanceID string) {
				defer wg.Done()
				id := fmt.Sprintf("%s_%d", instanceID, in)
				fmt.Printf("\nSTARTING [%s]\n\n", id)
				instance.MockInstance(envID, id, consulToken, dns, time.Duration(*keepAlive)*time.Second)
			}(i, *envID, *instanceID)
		}

		wg.Wait()
	} else {
		configurePlugin()
	}
}

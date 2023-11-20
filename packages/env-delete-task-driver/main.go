package main

import (
	"flag"
	"net/http"
	_ "net/http/pprof"

	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
	log "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins"

	driver "github.com/e2b-dev/infra/packages/env-delete-task-driver/internal"
)

const (
	profilingPort = ":6062"
)

func factory(log log.Logger) interface{} {
	return driver.NewPlugin(log)
}

func main() {
	// Create pprof endpoint for profiling
	go func() {
		http.ListenAndServe(profilingPort, nil)
	}()

	flag.Parse()

	shutdown := telemetry.InitOTLPExporter(driver.PluginName, driver.PluginVersion)
	defer shutdown()

	plugins.Serve(factory)
}

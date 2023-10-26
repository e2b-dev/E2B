package main

import (
	"flag"
	"github.com/e2b-dev/infra/packages/env-build-task-driver/internal/env"
	"github.com/e2b-dev/infra/packages/shared/utils"
	log "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins"
	"net/http"
	_ "net/http/pprof"

	driver "github.com/e2b-dev/infra/packages/env-build-task-driver/internal"
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

	envID := flag.String("env", "", "env id")
	buildID := flag.String("build", "", "build id")

	flag.Parse()

	if *envID != "" && *buildID != "" {
		// Start of mock build for testing
		env.MockBuild(*envID, *buildID)
		return
	}

	shutdown, err := utils.InitOTLPExporter(driver.PluginName, driver.PluginVersion)
	if err != nil {
		log.Fmt("failed to initialize OTLP exporter: %v", err)
	}

	defer shutdown()

	plugins.Serve(factory)
}

package main

import (
	"net/http"
	_ "net/http/pprof"

	log "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins"

	driver "github.com/e2b-dev/infra/packages/env-instance-task-driver/internal"
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

	configurePlugin()
}

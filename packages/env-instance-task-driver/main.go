package main

import (
	"net/http"
	_ "net/http/pprof"

	log "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins"

	driver "github.com/e2b-dev/infra/packages/env-instance-task-driver/internal"
	shared "github.com/e2b-dev/infra/packages/shared/pkg"
)

func configurePlugin() {
	// Create pprof endpoint for profiling
	go func() {
		http.ListenAndServe(":6061", nil)
	}()

	shutdown, err := shared.InitOTLPExporter(driver.PluginName, driver.PluginVersion)
	if err != nil {
		log.Fmt("failed to initialize OTLP exporter: %v", err)
	}
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

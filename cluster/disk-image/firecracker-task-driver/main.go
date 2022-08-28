package main

import (
	firevm "github.com/cneira/firecracker-task-driver/driver"
	log "github.com/hashicorp/go-hclog"
	"github.com/hashicorp/nomad/plugins"

	"net/http"

	_ "net/http/pprof"
)

func main() {
	go func() {
		http.ListenAndServe(":6061", nil)
	}()

	// Serve the plugin
	plugins.Serve(factory)
}

func factory(log log.Logger) interface{} {
	return firevm.NewFirecrackerDriver(log)
}

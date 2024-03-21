// portf (port forward) periodaically scans opened TCP ports on the 127.0.0.1 (or localhost)
// and launches `socat` process for every such port in the background.
// socat forward traffic from `sourceIP`:port to the 127.0.0.1:port.

// WARNING: portf isn't thread safe!

package port

import (
	"fmt"
	"net"
	"os/exec"

	"go.uber.org/zap"

	"github.com/e2b-dev/infra/packages/envd/internal/env"
)

type PortState string

const (
	PortStateForward PortState = "FORWARD"
	PortStateDelete  PortState = "DELETE"
)

type PortToForward struct {
	socat *exec.Cmd
	// Process ID of the process that's listening on port.
	pid   string
	state PortState
	port  int64
}

type Forwarder struct {
	logger *zap.SugaredLogger
	// Map of ports that are being currently forwarded.
	ports             map[string]*PortToForward
	scannerSubscriber *ScannerSubscriber
	sourceIP          net.IP
}

func NewForwarder(
	logger *zap.SugaredLogger,
	env *env.EnvConfig,
	scanner *Scanner,
) *Forwarder {
	scannerSub := scanner.AddSubscriber(
		"port-forwarder",
		// We only want to forward ports that are actively listening on localhost.
		&ScannerFilter{
			IPs:   []string{"127.0.0.1", "localhost"},
			State: "LISTEN",
		},
	)

	return &Forwarder{
		logger:            logger,
		sourceIP:          env.GatewayIP,
		ports:             make(map[string]*PortToForward),
		scannerSubscriber: scannerSub,
	}
}

func (f *Forwarder) StartForwarding() {
	if f.scannerSubscriber == nil {
		f.logger.Error("Cannot start forwarding because scanner subscriber is nil")

		return
	}

	for {
		// procs is an array of currently opened ports.
		if procs, ok := <-f.scannerSubscriber.Messages; ok {
			// Now we are going to refresh all ports that are being forwarded in the `ports` map. Maybe add new ones
			// and maybe remove some.

			// Go through the ports that are currently being forwarded and set all of them
			// to the `DELETE` state. We don't know yet if they will be there after refresh.
			for _, v := range f.ports {
				v.state = PortStateDelete
			}

			// Let's refresh our map of currently forwarded ports and mark the currently opened ones with the "FORWARD" state.
			// This will make sure we won't delete them later.
			for _, p := range procs {
				key := fmt.Sprintf("%s-%v", p.Pid, p.Port)

				// We check if the opened port is in our map of forwarded ports.
				val, portOk := f.ports[key]
				if portOk {
					// Just mark the port as being forwarded so we don't delete it.
					// The actual socat process that handles forwarding should be running from the last iteration.
					val.state = PortStateForward
				} else {
					f.logger.Debugw("Detected new opened port on localhost that is not forwarded",
						"ip", p.Ip,
						"port", p.Port,
						"state", p.State,
					)
					// The opened port wasn't in the map so we create a new PortToForward and start forwarding.
					ptf := &PortToForward{
						pid:   p.Pid,
						port:  p.Port,
						state: PortStateForward,
					}
					f.ports[key] = ptf
					f.starPortForwarding(ptf)
				}
			}

			// We go through the ports map one more time and stop forwarding all ports
			// that stayed marked as "DELETE".
			for _, v := range f.ports {
				if v.state == PortStateDelete {
					f.stopPortForwarding(v)
				}
			}
		}
	}
}

func (f *Forwarder) starPortForwarding(p *PortToForward) {
	// https://unix.stackexchange.com/questions/311492/redirect-application-listening-on-localhost-to-listening-on-external-interface
	// socat -d -d TCP4-LISTEN:4000,bind=169.254.0.21,fork TCP4:localhost:4000
	socatCmd := fmt.Sprintf(
		"socat -d -d -d TCP4-LISTEN:%v,bind=%s,fork TCP4:localhost:%v",
		p.port,
		f.sourceIP.To4(),
		p.port,
	)

	f.logger.Debugw("About to start port forwarding",
		"socatCmd", socatCmd,
		"pid", p.pid,
		"sourceIP", f.sourceIP.To4(),
		"port", p.port,
	)

	cmd := exec.Command("sh", "-c", socatCmd)
	if err := cmd.Start(); err != nil {
		f.logger.Errorw("Failed to start port forwarding - failed to start socat",
			"socatCmd", socatCmd,
			"error", err,
		)

		return
	}

	p.socat = cmd
}

func (f *Forwarder) stopPortForwarding(p *PortToForward) {
	if p.socat == nil {
		return
	}

	defer func() { p.socat = nil }()

	f.logger.Debugw("About to stop port forwarding",
		"socatCmd", p.socat.String(),
		"pid", p.pid,
		"sourceIP", f.sourceIP.To4(),
		"port", p.port,
	)

	if err := p.socat.Process.Kill(); err != nil {
		f.logger.Debugw("Error when stopping port forwarding",
			"socatCmd", p.socat.String(),
			"pid", p.pid,
			"sourceIP", f.sourceIP.To4(),
			"port", p.port,
			"error", err,
		)

		return
	}

	f.logger.Debugw("Stopped port forwarding",
		"socatCmd", p.socat.String(),
		"pid", p.pid,
		"sourceIP", f.sourceIP.To4(),
		"port", p.port,
	)
}

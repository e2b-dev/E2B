// portf (port forward) periodaically scans opened TCP ports on the 127.0.0.1 (or localhost)
// and launches `socat` process for every such port in the background.
// socat forward traffic from `sourceIP`:port to the 127.0.0.1:port.

// WARNING: portf isn't thread safe!

package port

import (
	"fmt"
	"net"
	"os/exec"
	"time"

	"github.com/devbookhq/devbookd/pkg/env"
	"github.com/drael/GOnetstat"
	"go.uber.org/zap"
)

type PortToForward struct {
	// pid of the process that's listening on port
	pid   string
	port  int64
	state string // "FORWARD" | "DELETE"

	socat *exec.Cmd
}

type Forwarder struct {
	logger *zap.SugaredLogger

	ticker   *time.Ticker
	sourceIP net.IP

	ports map[string]*PortToForward
}

func NewForwarder(
	logger *zap.SugaredLogger,
	env *env.Env,
	period time.Duration,
) *Forwarder {
	return &Forwarder{
		logger:   logger,
		ticker:   time.NewTicker(period),
		sourceIP: env.DefaultGatewayIP(),
		ports:    make(map[string]*PortToForward),
	}
}

// ScanAndForward starts scanning opened ports 127.0.0.1/localhost
// automatically tries to forward each of them to the PortForwarder.defaultGateway
func (pf *Forwarder) ScanAndForward() {
	for range pf.ticker.C {
		processes := GOnetstat.Tcp()

		// Now we are going to refresh all ports that are being forwarded. Maybe add new ones
		// and maybe remove some.

		// Go through the ports that are currently being forwarded and set all of them
		// to the `DELETE` state. We don't know yet if they will be there after refresh.
		for _, v := range pf.ports {
			v.state = "DELETE"
		}

		// Let's collect all currently opened ports on the localhost.
		// We also update our map of ports and mark the opened ones with the "FORWARD" state - this will make sure we won't delete them later.
		for _, p := range processes {
			if (p.Ip == "127.0.0.1" || p.Ip == "localhost") && p.State == "LISTEN" {
				key := fmt.Sprintf("%s-%v", p.Pid, p.Port)

				// We check if the opened port is in our map of forwarded ports.
				val, ok := pf.ports[key]
				if ok {
					// Just mark the port as being forwarded so we don't delete it.
					// The actual socat process that handles forwarding should be running from the last iteration.
					val.state = "FORWARD"
				} else {
					pf.logger.Infow("Detected new opened port on localhost that is not forwarded",
						"ip", p.Ip,
						"port", p.Port,
						"state", p.State,
					)
					// The opened port wasn't in the map so we create a new PortToForward and start forwarding.
					ptf := &PortToForward{p.Pid, p.Port, "FORWARD", nil}
					pf.ports[key] = ptf
					pf.starPortForwarding(ptf)
				}
			}
		}

		// We go through the ports map one more time and stop forwarding all ports
		// that stayed marked as "DELETE"
		for _, v := range pf.ports {
			if v.state == "DELETE" {
				pf.stopPortForwarding(v)
			}
		}
	}
}

func (pf *Forwarder) starPortForwarding(p *PortToForward) {
	// https://unix.stackexchange.com/questions/311492/redirect-application-listening-on-localhost-to-listening-on-external-interface
	// socat -d -d TCP4-LISTEN:4000,bind=169.254.0.21,fork TCP4:localhost:4000
	socatCmd := fmt.Sprintf(
		"socat -d -d -d TCP4-LISTEN:%v,bind=%s,fork TCP4:localhost:%v",
		p.port,
		pf.sourceIP.To4(),
		p.port,
	)

	pf.logger.Infow("About to start port forwarding",
		"socatCmd", socatCmd,
		"pid", p.pid,
		"sourceIP", pf.sourceIP.To4(),
		"port", p.port,
	)

	cmd := exec.Command("sh", "-c", socatCmd)
	if err := cmd.Start(); err != nil {
		pf.logger.Errorw("Failed to start port forwarding - failed to start socat",
			"socatCmd", socatCmd,
			"error", err,
		)
		return
	}
	p.socat = cmd
}

func (pf *Forwarder) stopPortForwarding(p *PortToForward) {
	if p.socat == nil {
		return
	}
	defer func() { p.socat = nil }()

	pf.logger.Infow("About to stop port forwarding",
		"socatCmd", p.socat.String(),
		"pid", p.pid,
		"sourceIP", pf.sourceIP.To4(),
		"port", p.port,
	)

	if err := p.socat.Process.Kill(); err != nil {
		pf.logger.Infow("Error when stopping port forwarding",
			"socatCmd", p.socat.String(),
			"pid", p.pid,
			"sourceIP", pf.sourceIP.To4(),
			"port", p.port,
			"error", err,
		)
		return
	}

	pf.logger.Infow("Stopped port forwarding",
		"socatCmd", p.socat.String(),
		"pid", p.pid,
		"sourceIP", pf.sourceIP.To4(),
		"port", p.port,
	)
}

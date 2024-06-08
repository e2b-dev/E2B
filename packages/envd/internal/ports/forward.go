package ports

import (
	"context"
	"fmt"
	"os/exec"
	"time"

	"github.com/rs/zerolog"
	psnet "github.com/shirou/gopsutil/v4/net"
)

// TODO: Can we start the envd on the gateway and then forward the ports to the host directly?
// This would avoid the need to forward the ports to the gateway separately.
// With 0.0.0.0 does the envd automatically listen to the gateway traffic without socat invocations?

// https://www.zupzup.org/go-port-forwarding/index.html
// https://medium.com/@nathanpbrophy/write-a-sample-port-forwarder-in-golang-2748309c1e80

// Even better, use ip tables to redirect.

const (
	scanPeriod  = 1 * time.Second
	forwardedIP = "127.0.0.1"
	gatewayIP   = "169.254.0.21"
)

type forwarding struct {
	cmd *exec.Cmd
}

func (f *forwarding) Stop() {
	f.cmd.Process.Kill()
}

type Forwarder struct {
	logger *zerolog.Logger
	ctx    context.Context

	ports map[uint32]*forwarding
}

func NewForwarder(
	ctx context.Context,
	logger *zerolog.Logger,
) *Forwarder {
	return &Forwarder{
		logger: logger,
		ctx:    ctx,
		ports:  make(map[uint32]*forwarding),
	}
}

func (f *Forwarder) Start() {
	ticker := time.NewTicker(scanPeriod)
	defer ticker.Stop()

	for {
		select {
		case <-f.ctx.Done():
			return
		case <-ticker.C:
			cs, err := psnet.Connections("tcp")
			if err != nil {
				f.logger.Err(err).Msg("failed to get connections")

				return
			}

			newPorts := make(map[uint32]*forwarding)

			for _, conn := range cs {
				if conn.Laddr.IP != forwardedIP {
					continue
				}

				forwarding, ok := f.ports[conn.Laddr.Port]
				if ok {
					newPorts[conn.Laddr.Port] = forwarding

					delete(f.ports, conn.Laddr.Port)

					continue
				}

				forwarding, forwardErr := f.forwardPort(conn.Laddr.Port)
				if forwardErr != nil {
					f.logger.Err(forwardErr).Msg("failed to forward port")

					continue
				}

				newPorts[conn.Laddr.Port] = forwarding
			}

			for _, forwarding := range f.ports {
				forwarding.Stop()
			}

			f.ports = newPorts
		}
	}
}

func (f *Forwarder) forwardPort(port uint32) (*forwarding, error) {
	// https://unix.stackexchange.com/questions/311492/redirect-application-listening-on-localhost-to-listening-on-external-interface
	// socat -d -d TCP4-LISTEN:4000,bind=169.254.0.21,fork TCP4:localhost:4000
	socatCmd := fmt.Sprintf(
		"socat -d -d -d TCP4-LISTEN:%v,bind=%s,fork TCP4:localhost:%v",
		port,
		gatewayIP,
		port,
	)

	cmd := exec.CommandContext(f.ctx, "/bin/bash", "-c", socatCmd)

	err := cmd.Start()
	if err != nil {
		return nil, fmt.Errorf("failed to start port forwarding - failed to start socat: %w", err)
	}

	go cmd.Wait()

	return &forwarding{
		cmd: cmd,
	}, nil
}

package ports

import (
	"context"
	"fmt"

	netstat "github.com/drael/GOnetstat"
	"github.com/ethereum/go-ethereum/rpc"
	"go.uber.org/zap"

	"github.com/e2b-dev/infra/packages/envd/internal/port"
	"github.com/e2b-dev/infra/packages/envd/internal/subscriber"
)

type Service struct {
	logger *zap.SugaredLogger

	scanOpenedPortsSubs *subscriber.Manager
	scannerSubscriber   *port.ScannerSubscriber
}

func NewService(
	logger *zap.SugaredLogger,
	portScanner *port.Scanner,
) *Service {
	scannerSub := portScanner.AddSubscriber(
		"code-snippet-service",
		nil,
	)

	cs := &Service{
		logger:              logger,
		scannerSubscriber:   scannerSub,
		scanOpenedPortsSubs: subscriber.NewManager("ports/scanOpenedPortsSubs", logger.Named("subscriber.ports.scanOpenedPorts")),
	}

	go cs.listenToOpenPorts()

	return cs
}

func (s *Service) listenToOpenPorts() {
	for {
		if procs, ok := <-s.scannerSubscriber.Messages; ok {
			s.notifyScanOpenedPorts(procs)
		}
	}
}

func (s *Service) notifyScanOpenedPorts(ports []netstat.Process) {
	err := s.scanOpenedPortsSubs.Notify("", ports)
	if err != nil {
		s.logger.Errorw("Failed to send scan opened ports notification",
			"error", err,
		)
	}
}

// Subscription
func (s *Service) ScanOpenedPorts(ctx context.Context) (*rpc.Subscription, error) {
	s.logger.Debug("Subscribing to scanning open ports")

	sub, _, err := s.scanOpenedPortsSubs.Create(ctx, "")
	if err != nil {
		s.logger.Errorw("Failed to create a scan opened ports subscription from context",
			"ctx", ctx,
			"error", err,
		)

		return nil, fmt.Errorf("error creating a scan opened ports subscription from context: %w", err)
	}

	s.logger.Debugw("Subscribed to scanning open ports",
		"subID", sub.Subscription.ID,
	)

	return sub.Subscription, nil
}

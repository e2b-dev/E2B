package driver

import (
	"context"
	"time"

	"github.com/hashicorp/nomad/plugins/drivers"
	"github.com/hashicorp/nomad/plugins/shared/structs"
)

const fingerprintPeriod = 30 * time.Second

func (d *Driver[Extra, TaskHandle]) Fingerprint(ctx context.Context) (<-chan *drivers.Fingerprint, error) {
	ch := make(chan *drivers.Fingerprint)
	go d.HandleFingerprint(ctx, ch)

	return ch, nil
}

func (d *Driver[Extra, TaskHandle]) HandleFingerprint(ctx context.Context, ch chan<- *drivers.Fingerprint) {
	defer close(ch)

	ticker := time.NewTimer(0)

	for {
		select {
		case <-ctx.Done():
			return
		case <-d.Ctx.Done():
			return
		case <-ticker.C:
			ticker.Reset(fingerprintPeriod)
			ch <- d.buildFingerprint()
		}
	}
}

func (d *Driver[Extra, TaskHandle]) buildFingerprint() *drivers.Fingerprint {
	return &drivers.Fingerprint{
		Attributes:        map[string]*structs.Attribute{},
		Health:            drivers.HealthStateHealthy,
		HealthDescription: drivers.DriverHealthy,
	}
}

package firecracker

import (
	"context"
	"time"
)

const (
	defaultAliveVMMCheckDur = 10 * time.Millisecond
)

// waitForAliveVMM will check for periodically to see if the firecracker VMM is
// alive. If the VMM takes too long in starting, an error signifying that will
// be returned.
func waitForAliveVMM(ctx context.Context, client *Client) error {
	t := time.NewTicker(defaultAliveVMMCheckDur)
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-t.C:
			if _, err := client.GetMachineConfiguration(); err == nil {
				return nil
			}
		}
	}
}

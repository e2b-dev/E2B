// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"). You may
// not use this file except in compliance with the License. A copy of the
// License is located at
//
//	http://aws.amazon.com/apache2.0/
//
// or in the "license" file accompanying this file. This file is distributed
// on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
// express or implied. See the License for the specific language governing
// permissions and limitations under the License.
package firecracker

import (
	"context"
	"os"
	"strconv"
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

// envValueOrDefaultInt check if env value exists and returns it or returns default value
// provided as a second param to this function
func envValueOrDefaultInt(envName string, def int) int {
	envVal, err := strconv.Atoi(os.Getenv(envName))
	if envVal == 0 || err != nil {
		envVal = def
	}
	return envVal
}

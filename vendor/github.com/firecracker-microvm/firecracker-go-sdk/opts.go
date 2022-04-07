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
	"os/exec"

	"github.com/sirupsen/logrus"
)

// Opt represents a functional option to help modify functionality of a Machine.
type Opt func(*Machine)

// WithClient will use the client in place rather than the client constructed
// during bootstrapping of the machine. This option is useful for mocking out
// tests.
func WithClient(client *Client) Opt {
	return func(machine *Machine) {
		machine.client = client
	}
}

// WithLogger will allow for the Machine to use the provided logger.
func WithLogger(logger *logrus.Entry) Opt {
	return func(machine *Machine) {
		machine.logger = logger
	}
}

// WithProcessRunner will allow for a specific command to be run instead of the
// default firecracker command.
// For example, this could be used to instead call the jailer instead of
// firecracker directly.
func WithProcessRunner(cmd *exec.Cmd) Opt {
	return func(machine *Machine) {
		machine.cmd = cmd
	}
}

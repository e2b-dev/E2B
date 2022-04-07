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
	"io"
	"os"
	"os/exec"
)

const defaultFcBin = "firecracker"

var defaultFirecrackerVMMCommandBuilder = VMCommandBuilder{}.
	WithBin(defaultFcBin).
	WithStdin(os.Stdin).
	WithStdout(os.Stdout).
	WithStderr(os.Stderr)

// VMCommandBuilder is a utility for building an exec.Cmd that represents how to
// start the Firecracker VMM.
type VMCommandBuilder struct {
	bin        string
	args       []string
	socketPath string
	stdin      io.Reader
	stdout     io.Writer
	stderr     io.Writer
}

// Args returns all args that will be passed to exec.Command
func (b VMCommandBuilder) Args() []string {
	return b.args
}

// WithArgs specifies which arguments to pass through to the
// firecracker exec.Command
func (b VMCommandBuilder) WithArgs(args []string) VMCommandBuilder {
	b.args = args
	return b
}

// AddArgs will append the provided args to the given command
func (b VMCommandBuilder) AddArgs(args ...string) VMCommandBuilder {
	b.args = append(b.args, args...)
	return b
}

// Bin returns the bin that was set. If bin had not been set, then the default
// will be returned.
func (b VMCommandBuilder) Bin() string {
	if len(b.bin) == 0 {
		return defaultFcBin
	}

	return b.bin
}

// WithBin specifies which binary for firecracker to use
func (b VMCommandBuilder) WithBin(bin string) VMCommandBuilder {
	b.bin = bin
	return b
}

// SocketPath returns the specified socket path
func (b VMCommandBuilder) SocketPath() []string {
	if len(b.socketPath) == 0 {
		return nil
	}

	return []string{
		"--api-sock",
		b.socketPath,
	}
}

// WithSocketPath specifies the socket path to be used when
// creating the firecracker exec.Command
func (b VMCommandBuilder) WithSocketPath(path string) VMCommandBuilder {
	b.socketPath = path
	return b
}

// Stdout will return the stdout that will be used when creating
// the firecracker exec.Command
func (b VMCommandBuilder) Stdout() io.Writer {
	return b.stdout
}

// WithStdout specifies which io.Writer to use in place of the
// os.Stdout in the firecracker exec.Command.
func (b VMCommandBuilder) WithStdout(stdout io.Writer) VMCommandBuilder {
	b.stdout = stdout
	return b
}

// Stderr will return the stderr that will be used when creating
// the firecracker exec.Command
func (b VMCommandBuilder) Stderr() io.Writer {
	return b.stderr
}

// WithStderr specifies which io.Writer to use in place of the
// os.Stderr in the firecracker exec.Command.
func (b VMCommandBuilder) WithStderr(stderr io.Writer) VMCommandBuilder {
	b.stderr = stderr
	return b
}

// Stdin will return the stdin that will be used when creating
// the firecracker exec.Command
func (b VMCommandBuilder) Stdin() io.Reader {
	return b.stdin
}

// WithStdin specifies which io.Reader to use in place of the
// os.Stdin in the firecracker exec.Command.
func (b VMCommandBuilder) WithStdin(stdin io.Reader) VMCommandBuilder {
	b.stdin = stdin
	return b
}

// Build will build a firecracker command using the specific arguments
// specified in the builder.
func (b VMCommandBuilder) Build(ctx context.Context) *exec.Cmd {
	args := []string{}
	if socketPath := b.SocketPath(); socketPath != nil {
		args = append(args, socketPath...)
	}
	if v := b.Args(); v != nil {
		args = append(args, v...)
	}

	cmd := exec.CommandContext(
		ctx,
		b.Bin(),
		args...,
	)

	if stdout := b.Stdout(); stdout != nil {
		cmd.Stdout = stdout
	}
	if stderr := b.Stderr(); stderr != nil {
		cmd.Stderr = stderr
	}
	if stdin := b.Stdin(); stdin != nil {
		cmd.Stdin = stdin
	}

	return cmd
}

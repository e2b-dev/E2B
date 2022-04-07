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
	"github.com/go-openapi/runtime"
	"net"
	"net/http"

	httptransport "github.com/go-openapi/runtime/client"
	"github.com/sirupsen/logrus"

	"github.com/firecracker-microvm/firecracker-go-sdk/client"
)

// NewUnixSocketTransport creates a new clientTransport configured at the specified Unix socketPath.
func NewUnixSocketTransport(socketPath string, logger *logrus.Entry, debug bool) runtime.ClientTransport {
	socketTransport := &http.Transport{
		DialContext: func(ctx context.Context, network, path string) (net.Conn, error) {
			addr, err := net.ResolveUnixAddr("unix", socketPath)
			if err != nil {
				return nil, err
			}

			return net.DialUnix("unix", nil, addr)
		},
	}

	transport := httptransport.New(client.DefaultHost, client.DefaultBasePath, client.DefaultSchemes)
	transport.Transport = socketTransport

	if debug {
		transport.SetDebug(debug)
	}

	if logger != nil {
		transport.SetLogger(logger)
	}

	return transport
}

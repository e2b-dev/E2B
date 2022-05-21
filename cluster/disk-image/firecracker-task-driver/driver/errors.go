// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

package firevm

import "errors"

var (
	// Error parsing nic config
	errInvalidNicConfig = errors.New("NIC config wasn't of the form DEVICE/MACADDR")

	// error parsing blockdevices
	errInvalidDriveSpecificationNoSuffix = errors.New("invalid drive specification. Must have :rw or :ro suffix")
	errInvalidDriveSpecificationNoPath   = errors.New("invalid drive specification. Must have path")

	// error parsing vsock
	errUnableToParseVsockDevices = errors.New("unable to parse vsock devices")
	errUnableToParseVsockCID     = errors.New("unable to parse vsock CID as a number")

	errConflictingLogOpts        = errors.New("vmm-log-fifo and firecracker-log cannot be used together")
	errConflictingNetworkOpts    = errors.New("network and nic cannot be used together")
	errUnableToCreateFifoLogFile = errors.New("failed to create fifo log file")

	// error with firecracker config
	errInvalidMetadata = errors.New("invalid metadata, unable to parse as json")
)

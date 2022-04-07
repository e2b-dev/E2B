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
)

// This ensures the interface method signatures match that of Machine
var _ MachineIface = (*Machine)(nil)

// MachineIface can be used for mocking and testing of the Machine. The Machine
// is subject to change, meaning this interface would change.
type MachineIface interface {
	Start(context.Context) error
	StopVMM() error
	Shutdown(context.Context) error
	Wait(context.Context) error
	SetMetadata(context.Context, interface{}) error
	UpdateGuestDrive(context.Context, string, string, ...PatchGuestDriveByIDOpt) error
	UpdateGuestNetworkInterfaceRateLimit(context.Context, string, RateLimiterSet, ...PatchGuestNetworkInterfaceByIDOpt) error
}

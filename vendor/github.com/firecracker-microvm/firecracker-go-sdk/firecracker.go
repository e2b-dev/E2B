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

package firecracker

import (
	"context"
	"time"

	"github.com/go-openapi/strfmt"

	"github.com/sirupsen/logrus"

	"github.com/firecracker-microvm/firecracker-go-sdk/client"
	models "github.com/firecracker-microvm/firecracker-go-sdk/client/models"
	ops "github.com/firecracker-microvm/firecracker-go-sdk/client/operations"
)

const firecrackerRequestTimeout = 500 * time.Millisecond

// newFirecrackerClient creates a FirecrackerClient
func newFirecrackerClient(socketPath string, logger *logrus.Entry, debug bool) *client.Firecracker {
	httpClient := client.NewHTTPClient(strfmt.NewFormats())

	transport := NewUnixSocketTransport(socketPath, logger, debug)
	httpClient.SetTransport(transport)

	return httpClient
}

// ClientOpt is a functional option used to modify the client after construction.
type ClientOpt func(*Client)

// WithOpsClient will return a functional option and replace the operations
// client. This is useful for mock and stub testing.
func WithOpsClient(opsClient ops.ClientIface) ClientOpt {
	return func(c *Client) {
		c.client.Operations = opsClient
	}
}

// Client is a client for interacting with the Firecracker API
type Client struct {
	client *client.Firecracker
}

// NewClient creates a Client
func NewClient(socketPath string, logger *logrus.Entry, debug bool, opts ...ClientOpt) *Client {
	httpClient := newFirecrackerClient(socketPath, logger, debug)
	c := &Client{client: httpClient}
	for _, opt := range opts {
		opt(c)
	}

	return c
}

// PutLoggerOpt is a functional option to be used for the PutLogger API in
// setting any additional optional fields.
type PutLoggerOpt func(*ops.PutLoggerParams)

// PutLogger is a wrapper for the swagger generated client to make calling of
// the API easier.
func (f *Client) PutLogger(ctx context.Context, logger *models.Logger, opts ...PutLoggerOpt) (*ops.PutLoggerNoContent, error) {
	timeout, cancel := context.WithTimeout(ctx, firecrackerRequestTimeout)
	defer cancel()

	loggerParams := ops.NewPutLoggerParamsWithContext(timeout)
	loggerParams.SetBody(logger)
	for _, opt := range opts {
		opt(loggerParams)
	}

	return f.client.Operations.PutLogger(loggerParams)
}

// PutMachineConfigurationOpt is a functional option to be used for the
// PutMachineConfiguration API in setting any additional optional fields.
type PutMachineConfigurationOpt func(*ops.PutMachineConfigurationParams)

// PutMachineConfiguration is a wrapper for the swagger generated client to
// make calling of the API easier.
func (f *Client) PutMachineConfiguration(ctx context.Context, cfg *models.MachineConfiguration, opts ...PutMachineConfigurationOpt) (*ops.PutMachineConfigurationNoContent, error) {
	timeout, cancel := context.WithTimeout(ctx, firecrackerRequestTimeout)
	defer cancel()

	mc := ops.NewPutMachineConfigurationParamsWithContext(timeout)
	mc.SetBody(cfg)
	for _, opt := range opts {
		opt(mc)
	}

	return f.client.Operations.PutMachineConfiguration(mc)
}

// PutGuestBootSourceOpt is a functional option to be used for the
// PutGuestBootSource API in setting any additional optional fields.
type PutGuestBootSourceOpt func(*ops.PutGuestBootSourceParams)

// PutGuestBootSource is a wrapper for the swagger generated client to make
// calling of the API easier.
func (f *Client) PutGuestBootSource(ctx context.Context, source *models.BootSource, opts ...PutGuestBootSourceOpt) (*ops.PutGuestBootSourceNoContent, error) {
	timeout, cancel := context.WithTimeout(ctx, firecrackerRequestTimeout)
	defer cancel()

	bootSource := ops.NewPutGuestBootSourceParamsWithContext(timeout)
	bootSource.SetBody(source)
	for _, opt := range opts {
		opt(bootSource)
	}

	return f.client.Operations.PutGuestBootSource(bootSource)
}

// PutGuestNetworkInterfaceByIDOpt is a functional option to be used for the
// PutGuestNetworkInterfaceByID API in setting any additional optional fields.
type PutGuestNetworkInterfaceByIDOpt func(*ops.PutGuestNetworkInterfaceByIDParams)

// PutGuestNetworkInterfaceByID is a wrapper for the swagger generated client
// to make calling of the API easier.
func (f *Client) PutGuestNetworkInterfaceByID(ctx context.Context, ifaceID string, ifaceCfg *models.NetworkInterface, opts ...PutGuestNetworkInterfaceByIDOpt) (*ops.PutGuestNetworkInterfaceByIDNoContent, error) {
	timeout, cancel := context.WithTimeout(ctx, firecrackerRequestTimeout)
	defer cancel()

	cfg := ops.NewPutGuestNetworkInterfaceByIDParamsWithContext(timeout)
	cfg.SetBody(ifaceCfg)
	cfg.SetIfaceID(ifaceID)
	for _, opt := range opts {
		opt(cfg)
	}

	return f.client.Operations.PutGuestNetworkInterfaceByID(cfg)
}

// PatchGuestNetworkInterfaceByIDOpt is a functional option to be used for the
// PatchGuestNetworkInterfaceByID API in setting any additional optional fields.
type PatchGuestNetworkInterfaceByIDOpt func(*ops.PatchGuestNetworkInterfaceByIDParams)

// PatchGuestNetworkInterfaceByID is a wrapper for the swagger generated client to make calling of the
// API easier.
func (f *Client) PatchGuestNetworkInterfaceByID(ctx context.Context, ifaceID string, ifaceCfg *models.PartialNetworkInterface, opts ...PatchGuestNetworkInterfaceByIDOpt) (*ops.PatchGuestNetworkInterfaceByIDNoContent, error) {
	timeout, cancel := context.WithTimeout(ctx, firecrackerRequestTimeout)
	defer cancel()

	cfg := ops.NewPatchGuestNetworkInterfaceByIDParamsWithContext(timeout)
	cfg.SetBody(ifaceCfg)
	cfg.SetIfaceID(ifaceID)

	for _, opt := range opts {
		opt(cfg)
	}

	return f.client.Operations.PatchGuestNetworkInterfaceByID(cfg)
}

// PutGuestDriveByIDOpt is a functional option to be used for the
// PutGuestDriveByID API in setting any additional optional fields.
type PutGuestDriveByIDOpt func(*ops.PutGuestDriveByIDParams)

// PutGuestDriveByID is a wrapper for the swagger generated client to make
// calling of the API easier.
func (f *Client) PutGuestDriveByID(ctx context.Context, driveID string, drive *models.Drive, opts ...PutGuestDriveByIDOpt) (*ops.PutGuestDriveByIDNoContent, error) {
	timeout, cancel := context.WithTimeout(ctx, 250*time.Millisecond)
	defer cancel()

	params := ops.NewPutGuestDriveByIDParamsWithContext(timeout)
	params.SetDriveID(driveID)
	params.SetBody(drive)
	for _, opt := range opts {
		opt(params)
	}

	return f.client.Operations.PutGuestDriveByID(params)
}

// PutGuestVsockByIDOpt is a functional option to be used for the
// PutGuestVsockByID API in setting any additional optional fields.
type PutGuestVsockByIDOpt func(*ops.PutGuestVsockByIDParams)

// PutGuestVsockByID is a wrapper for the swagger generated client to make
// calling of the API easier.
func (f *Client) PutGuestVsockByID(ctx context.Context, vsockID string, vsock *models.Vsock, opts ...PutGuestVsockByIDOpt) (*ops.PutGuestVsockByIDCreated, *ops.PutGuestVsockByIDNoContent, error) {
	params := ops.NewPutGuestVsockByIDParams()
	params.SetContext(ctx)
	params.SetID(vsockID)
	params.SetBody(vsock)
	for _, opt := range opts {
		opt(params)
	}

	return f.client.Operations.PutGuestVsockByID(params)
}

// CreateSyncActionOpt is a functional option to be used for the
// CreateSyncAction API in setting any additional optional fields.
type CreateSyncActionOpt func(*ops.CreateSyncActionParams)

// CreateSyncAction is a wrapper for the swagger generated client to make
// calling of the API easier.
func (f *Client) CreateSyncAction(ctx context.Context, info *models.InstanceActionInfo, opts ...CreateSyncActionOpt) (*ops.CreateSyncActionNoContent, error) {
	params := ops.NewCreateSyncActionParams()
	params.SetContext(ctx)
	params.SetInfo(info)
	for _, opt := range opts {
		opt(params)
	}

	return f.client.Operations.CreateSyncAction(params)
}

// PutMmdsOpt is a functional option to be used for the PutMmds API in setting
// any additional optional fields.
type PutMmdsOpt func(*ops.PutMmdsParams)

// PutMmds is a wrapper for the swagger generated client to make calling of the
// API easier.
func (f *Client) PutMmds(ctx context.Context, metadata interface{}, opts ...PutMmdsOpt) (*ops.PutMmdsNoContent, error) {
	params := ops.NewPutMmdsParams()
	params.SetContext(ctx)
	params.SetBody(metadata)
	for _, opt := range opts {
		opt(params)
	}

	return f.client.Operations.PutMmds(params)
}

// GetMmdsOpt is a functional option to be used for the GetMmds API in setting
// any additional optional fields.
type GetMmdsOpt func(*ops.GetMmdsParams)

// GetMmds is a wrapper for the swagger generated client to make calling of the
// API easier.
func (f *Client) GetMmds(ctx context.Context, opts ...GetMmdsOpt) (*ops.GetMmdsOK, error) {
	params := ops.NewGetMmdsParams()
	params.SetContext(ctx)
	for _, opt := range opts {
		opt(params)
	}

	return f.client.Operations.GetMmds(params)
}

// PatchMmdsOpt is a functional option to be used for the GetMmds API in setting
// any additional optional fields.
type PatchMmdsOpt func(*ops.PatchMmdsParams)

// PatchMmds is a wrapper for the swagger generated client to make calling of the
// API easier.
func (f *Client) PatchMmds(ctx context.Context, metadata interface{}, opts ...PatchMmdsOpt) (*ops.PatchMmdsNoContent, error) {
	params := ops.NewPatchMmdsParams()
	params.SetContext(ctx)
	params.SetBody(metadata)
	for _, opt := range opts {
		opt(params)
	}

	return f.client.Operations.PatchMmds(params)
}

// GetMachineConfigurationOpt  is a functional option to be used for the
// GetMachineConfiguration API in setting any additional optional fields.
type GetMachineConfigurationOpt func(*ops.GetMachineConfigurationParams)

// GetMachineConfiguration is a wrapper for the swagger generated client to make
// calling of the API easier.
func (f *Client) GetMachineConfiguration(opts ...GetMachineConfigurationOpt) (*ops.GetMachineConfigurationOK, error) {
	p := ops.NewGetMachineConfigurationParams()
	p.SetTimeout(firecrackerRequestTimeout)
	for _, opt := range opts {
		opt(p)
	}

	return f.client.Operations.GetMachineConfiguration(p)
}

// PatchGuestDriveByIDOpt is a functional option to be used for the PutMmds API in setting
// any additional optional fields.
type PatchGuestDriveByIDOpt func(*ops.PatchGuestDriveByIDParams)

// PatchGuestDriveByID is a wrapper for the swagger generated client to make calling of the
// API easier.
func (f *Client) PatchGuestDriveByID(ctx context.Context, driveID, pathOnHost string, opts ...PatchGuestDriveByIDOpt) (*ops.PatchGuestDriveByIDNoContent, error) {
	params := ops.NewPatchGuestDriveByIDParams()
	params.SetContext(ctx)

	partialDrive := models.PartialDrive{
		DriveID:    &driveID,
		PathOnHost: &pathOnHost,
	}
	params.SetBody(&partialDrive)
	params.DriveID = driveID

	for _, opt := range opts {
		opt(params)
	}

	return f.client.Operations.PatchGuestDriveByID(params)
}

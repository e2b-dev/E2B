package internal

import "errors"

var (
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

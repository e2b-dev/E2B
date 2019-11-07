package firecracker

import (
	"strconv"

	models "github.com/firecracker-microvm/firecracker-go-sdk/client/models"
)

const rootDriveName = "root_drive"

// DrivesBuilder is a builder that will build an array of drives used to set up
// the firecracker microVM. The DriveID will be an incrementing number starting
// at one
type DrivesBuilder struct {
	rootDrive models.Drive
	drives    []models.Drive
}

// NewDrivesBuilder will return a new DrivesBuilder with a given rootfs.
func NewDrivesBuilder(rootDrivePath string) DrivesBuilder {
	return DrivesBuilder{}.WithRootDrive(rootDrivePath)
}

// DriveOpt represents an optional function used to allow for specific
// customization of the models.Drive structure.
type DriveOpt func(*models.Drive)

// WithRootDrive will set the given builder with the a new root path. The root
// drive will be set to read and write by default.
func (b DrivesBuilder) WithRootDrive(rootDrivePath string, opts ...DriveOpt) DrivesBuilder {
	b.rootDrive = models.Drive{
		DriveID:      String(rootDriveName),
		PathOnHost:   &rootDrivePath,
		IsRootDevice: Bool(true),
		IsReadOnly:   Bool(false),
	}

	for _, opt := range opts {
		opt(&b.rootDrive)
	}

	return b
}

// AddDrive will add a new drive to the given builder.
func (b DrivesBuilder) AddDrive(path string, readOnly bool, opts ...DriveOpt) DrivesBuilder {
	drive := models.Drive{
		DriveID:      String(strconv.Itoa(len(b.drives))),
		PathOnHost:   &path,
		IsRootDevice: Bool(false),
		IsReadOnly:   &readOnly,
	}

	for _, opt := range opts {
		opt(&drive)
	}

	b.drives = append(b.drives, drive)
	return b
}

// Build will construct an array of drives with the root drive at the very end.
func (b DrivesBuilder) Build() []models.Drive {
	return append(b.drives, b.rootDrive)
}

package sandbox

import (
	"strings"

	"github.com/Masterminds/semver/v3"
)

type VersionInfo struct {
	commitHash         string
	lastReleaseVersion semver.Version
}

func stripVersionPrefix(version string) string {
	return strings.TrimPrefix(version, "v")
}

func NewVersionInfo(fcVersion string) (info VersionInfo, err error) {
	// The structure of the fcVersion is last_tag[-prerelease]_commit_hash
	// Example: v1.0.0-release_1234567

	parts := strings.Split(fcVersion, "_")

	versionString := stripVersionPrefix(parts[0])

	version, versionErr := semver.NewVersion(versionString)
	if versionErr != nil {
		return info, versionErr
	}

	info.lastReleaseVersion = *version
	info.commitHash = parts[1]

	return info, nil
}

func (v *VersionInfo) HasHugePages() bool {
	if v.lastReleaseVersion.Major() >= 1 && v.lastReleaseVersion.Minor() >= 7 {
		return true
	}

	return false
}

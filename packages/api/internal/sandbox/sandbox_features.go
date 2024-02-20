package sandbox

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/Masterminds/semver/v3"
)

type VersionInfo struct {
	commitsAfterLastTag int
	commitHash          string
	lastReleaseVersion  semver.Version
}

func stripVersionPrefix(version string) string {
	return strings.TrimPrefix(version, "v")
}

func NewVersionInfo(fcVersion string) (info VersionInfo, err error) {
	// The structure of the fcVersion is <last_tag[-prerelease]>[-commits_after_tag][-commit_hash]
	// Example: v1.0.0-1-g1234567
	// The following code extracts the last tag and the commits after tag in code

	parts := strings.Split(fcVersion, "-")

	if len(parts) == 1 {
		// There is only tag without any prelease
		versionString := stripVersionPrefix(parts[0])

		version, versionErr := semver.NewVersion(versionString)
		if versionErr != nil {
			return info, versionErr
		}

		info.lastReleaseVersion = *version
	} else if len(parts) == 2 {
		// There is a tag and a prelease
		versionString := fmt.Sprintf("%s-%s", stripVersionPrefix(parts[0]), parts[1])

		version, versionErr := semver.NewVersion(versionString)
		if versionErr != nil {
			return info, versionErr
		}

		info.lastReleaseVersion = *version
	} else if len(parts) == 3 {
		// There is a tag, commits after tag and a commit hash
		versionString := stripVersionPrefix(parts[0])

		version, versionErr := semver.NewVersion(versionString)
		if versionErr != nil {
			return info, versionErr
		}

		info.lastReleaseVersion = *version

		commitsAfter, err := strconv.Atoi(parts[1])
		if err != nil {
			return info, err
		}

		info.commitsAfterLastTag = commitsAfter
		info.commitHash = parts[2]
	} else if len(parts) == 4 {
		// There is a tag, prelease, commits after tag and a commit hash
		versionString := fmt.Sprintf("%s-%s", stripVersionPrefix(parts[0]), parts[1])

		version, versionErr := semver.NewVersion(versionString)
		if versionErr != nil {
			return info, versionErr
		}

		info.lastReleaseVersion = *version

		commitsAfter, err := strconv.Atoi(parts[1])
		if err != nil {
			return info, err
		}

		info.commitsAfterLastTag = commitsAfter
		info.commitHash = parts[3]
	}

	return info, nil
}

func (v *VersionInfo) HasHugePages() bool {
	if v.lastReleaseVersion.Major() >= 1 && v.lastReleaseVersion.Minor() >= 7 && v.lastReleaseVersion.Prerelease() == "dev" && v.commitsAfterLastTag >= 252 {
		return true
	}

	// TODO: When the next release is out (the huge pages should be in dev preview then), we should fixate this check only on the major version+minor version

	return false
}

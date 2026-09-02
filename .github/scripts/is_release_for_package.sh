#!/bin/sh

# This script checks if the specified package has changesets in the current commit.

set -eu

if [ $# -lt 1 ]; then
  echo "Error: Package name is required as the first argument." >&2
  exit 1
fi

PACKAGE_NAME=$1
PACKAGE_CHANGES=$(node -e "require('@changesets/read').default(process.cwd()).then(result => console.log(result.flatMap(changeset => changeset.releases.flatMap(release => release.name)).includes('${PACKAGE_NAME}')))")

echo "${PACKAGE_CHANGES}"

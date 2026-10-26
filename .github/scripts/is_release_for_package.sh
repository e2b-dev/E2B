#!/bin/sh

# This script checks if the specified package is in the release plan.

set -eu

if [ $# -lt 2 ]; then
  echo "Error: Package name and release plan are required." >&2
  exit 1
fi

PACKAGE_CHANGES=$(node -e 'console.log(JSON.parse(require("node:fs").readFileSync(process.argv[2], "utf8")).releases.some(release => release.name === process.argv[1]))' "$1" "$2")

echo "${PACKAGE_CHANGES}"

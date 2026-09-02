#!/bin/sh

# This script checks if the current commit contains changesets.

set -eu

CHANGES=$(node -e "require('@changesets/read').default(process.cwd()).then(result => console.log(!!result.length))")

echo "${CHANGES}"

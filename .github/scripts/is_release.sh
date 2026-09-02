#!/bin/sh

# Check for a new release or an explicit retry of already-versioned packages.

set -eu

CHANGES=$(node -e "require('@changesets/read').default(process.cwd()).then(result => console.log(!!result.length))")

if [ "${PUBLISH_EXISTING:-false}" = "true" ]; then
  if [ "$CHANGES" = "true" ]; then
    echo "::error::Cannot publish existing versions with pending changesets. Run a normal release instead." >&2
    exit 1
  fi
  echo true
  exit 0
fi

echo "${CHANGES}"

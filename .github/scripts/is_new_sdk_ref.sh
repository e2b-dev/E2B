#!/usr/bin/env bash

set -euo pipefail

# This script checks for diffs in the packages directory.
# If there are diffs, it means we need to generate new SDK references.
if git diff --name-only HEAD^ | grep -q '^packages/'; then
    echo "true"
else
    echo "false"
fi

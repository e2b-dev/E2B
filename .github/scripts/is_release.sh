#!/bin/sh

# This script checks if the release plan contains packages.

set -eu

CHANGES=$(node -e 'console.log(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).releases.length > 0)' "$1")

echo "${CHANGES}"

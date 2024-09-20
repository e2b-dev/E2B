#!/usr/bin/env bash

set -euo pipefail

# This script generates the CLI API reference markdown files
## Run it in the `cli/` directory
mkdir -p api_ref

npx tsup && echo && NODE_ENV=development node dist/index.js -cmd2md

# move to docs (for later use)
#for file in api_ref/*.md; do
#    # Extract the filename without extension
#    filename=$(basename "$file" .md)
#
#    # Create the directory if it doesn't exist
#    mkdir -p "../../apps/web/src/app/(docs)/docs/api-reference/cli/$filename"
#
#    # Move the file to the new location and rename it to page.mdx
#    mv "$file" "../../apps/web/src/app/(docs)/docs/api-reference/cli/$filename/page.mdx"
#done

#!/usr/bin/env bash

set -euo pipefail

# This script generates the CLI SDK reference markdown files
## Run it in the `cli/` directory
mkdir -p sdk_ref

npx tsup && NODE_ENV=development node dist/index.js -cmd2md

PKG_VERSION="v$(node -p "require('./package.json').version")"

# move to docs web app
for file in sdk_ref/*.md; do
    # Extract the filename without extension
    filename=$(basename "$file" .md)

    # Create the directory if it doesn't exist
    mkdir -p "../../apps/web/src/app/(docs)/docs/sdk-reference/cli/${PKG_VERSION}/${filename}"

    # Move the file to the new location and rename it to page.mdx
    mv "$file" "../../apps/web/src/app/(docs)/docs/sdk-reference/cli/${PKG_VERSION}/${filename}/page.mdx"
done

rm -rf sdk_ref

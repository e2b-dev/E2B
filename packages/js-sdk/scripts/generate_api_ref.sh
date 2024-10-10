#!/usr/bin/env bash

set -euo pipefail

# This script generates the JS SDK API reference markdown files
# Run it in the `js-sdk/` directory

# generate raw api reference markdown files
npx typedoc

PKG_VERSION="v$(node -p "require('./package.json').version")"
ROUTES_DIR="../../apps/web/src/app/(docs)/docs/api-reference/js-sdk/${PKG_VERSION}"
# move to docs web app
mkdir -p "${ROUTES_DIR}"

rm -rf api_ref/README.md

# Flatten the api_ref directory by moving all nested files to the root level and remove empty subdirectories
find api_ref -mindepth 2 -type f | while read -r file; do
    mv "$file" api_ref/
done
find api_ref -type d -empty -delete

# Transfrom top level MD files into folders of the same name with page.mdx inside
find api_ref -maxdepth 1 -type f -name "*.md" | while read -r file; do
    # Extract the filename without extension
    filename=$(basename "$file" .md)
    # Create the directory of the same name in api_ref
    mkdir -p "api_ref/${filename}"
    # Move the file inside the newly created directory
    mv "$file" "api_ref/${filename}/page.mdx"
done

cp -r api_ref/* "${ROUTES_DIR}"

rm -rf api_ref

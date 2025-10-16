#!/usr/bin/env bash

set -euo pipefail

# This script generates the JS SDK reference markdown files
# Run it in the `js-sdk/` directory

# generate raw SDK reference markdown files
npx typedoc

PKG_VERSION="v$(node -p "require('./package.json').version")"
ROUTES_DIR="../../apps/web/src/app/(docs)/docs/sdk-reference/js-sdk/${PKG_VERSION}"
template_submodules=("logger" "readycmd")

# move to docs web app
mkdir -p "${ROUTES_DIR}"

rm -rf sdk_ref/README.md

# Flatten the sdk_ref directory by moving all nested files to the root level and remove empty subdirectories
find sdk_ref -mindepth 2 -type f | while read -r file; do
    mv "$file" sdk_ref/
done
find sdk_ref -type d -empty -delete

# Transfrom top level MD files into folders of the same name with page.mdx inside
find sdk_ref -maxdepth 1 -type f -name "*.md" | while read -r file; do
    # Extract the filename without extension
    filename=$(basename "$file" .md)
    # Create the directory of the same name in sdk_ref
    mkdir -p "sdk_ref/${filename}"
    # Move the file inside the newly created directory
    mv "$file" "sdk_ref/${filename}/page.mdx"
done

# Move template-related modules under template directory
if [ -d "sdk_ref/template" ]; then
    for module in "${template_submodules[@]}"; do
        if [ -d "sdk_ref/${module}" ]; then
            mv "sdk_ref/${module}" "sdk_ref/template/"
        fi
    done
fi

cp -r sdk_ref/* "${ROUTES_DIR}"

rm -rf sdk_ref

#!/usr/bin/env bash

set -euo pipefail

# This script generates the python sdk api reference markdown files
# Run it in the `python-sdk/` directory

PKG_VERSION="v$(node -p "require('./package.json').version")"

packages=("sandbox_sync" "sandbox_async" "exceptions")

mkdir -p ../../apps/web/src/app/\(docs\)/docs/api-reference/python-sdk/${PKG_VERSION}

mkdir -p api_ref

for package in "${packages[@]}"; do
    # generate raw api reference markdown file
    pydoc-markdown -p e2b."${package}" >api_ref/"${package}".mdx
    # remove package path display
    sed -i '/<a[^>]*>.*<\/a>/d' api_ref/"${package}".mdx
    # remove empty hyperlinks
    sed -i '/^# /d' "api_ref/${package}.mdx"
    # remove " Objects" from lines starting with "##"
    sed -i '/^## / s/ Objects$//' "api_ref/${package}.mdx"
    # move to docs
    mkdir -p "../../apps/web/src/app/(docs)/docs/api-reference/python-sdk/${PKG_VERSION}/${package}"
    mv "api_ref/${package}.mdx" "../../apps/web/src/app/(docs)/docs/api-reference/python-sdk/${PKG_VERSION}/${package}/page.mdx"
done

rm -rf api_ref

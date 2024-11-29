#!/usr/bin/env bash

set -euo pipefail

# This script generates the python SDK reference markdown files
# Run it in the `python-sdk/` directory

PKG_VERSION="v$(node -p "require('./package.json').version")"

packages=("sandbox_sync" "sandbox_async" "exceptions")

mkdir -p ../../apps/web/src/app/\(docs\)/docs/sdk-reference/python-sdk/${PKG_VERSION}

mkdir -p sdk_ref

for package in "${packages[@]}"; do
    # generate raw SDK reference markdown file
    poetry run pydoc-markdown -p e2b."${package}" >sdk_ref/"${package}".mdx
    # remove package path display
    sed -i'' -e '/<a[^>]*>.*<\/a>/d' "sdk_ref/${package}.mdx"
    # remove empty hyperlinks
    sed -i'' -e '/^# /d' "sdk_ref/${package}.mdx"
    # remove " Objects" from lines starting with "##"
    sed -i'' -e '/^## / s/ Objects$//' "sdk_ref/${package}.mdx"
    # replace lines starting with "####" with "###"
    sed -i'' -e 's/^####/###/' "sdk_ref/${package}.mdx"
    # move to docs
    mkdir -p "../../apps/web/src/app/(docs)/docs/sdk-reference/python-sdk/${PKG_VERSION}/${package}"
    mv "sdk_ref/${package}.mdx" "../../apps/web/src/app/(docs)/docs/sdk-reference/python-sdk/${PKG_VERSION}/${package}/page.mdx"
done

rm -rf sdk_ref

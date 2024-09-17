#!/usr/bin/env bash

# This script generates the python sdk api reference markdown files
# Run it in the `python-sdk/` directory

packages=("sandbox_sync" "sandbox_async" "exceptions")

mkdir api_ref

for package in "${packages[@]}"; do
    # generate raw api reference markdown file
    pydoc-markdown -p e2b.${package} >api_ref/${package}.mdx
    # remove package path display
    sed -i '' '/<a[^>]*>.*<\/a>/d' api_ref/${package}.mdx
    # remove empty hyperlinks
    sed -i '' '/^# /d' api_ref/${package}.mdx
    # move to docs (for later use)
    # mv api_ref/${package}.mdx ../../apps/web/src/app/\(docs\)/docs/api-reference/python-sdk/${package}/page.mdx
done

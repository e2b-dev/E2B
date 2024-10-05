#!/usr/bin/env bash

set -euo pipefail

# This script generates the JS SDK API reference markdown files
# Run it in the `js-sdk/` directory

# generate raw api reference markdown files
npx typedoc

# move to docs (for later use)
#mkdir -p ../../apps/web/src/app/\(docs\)/docs/api-reference/js-sdk/sandbox
#mv api_ref/sandbox.md ../../apps/web/src/app/\(docs\)/docs/api-reference/js-sdk/sandbox/page.mdx
#
#mkdir -p ../../apps/web/src/app/\(docs\)/docs/api-reference/js-sdk/errors
#mv api_ref/errors.md ../../apps/web/src/app/\(docs\)/docs/api-reference/js-sdk/errors/page.mdx
#
#mkdir -p ../../apps/web/src/app/\(docs\)/docs/api-reference/js-sdk/filesystem
#mv api_ref/sandbox/filesystem.md ../../apps/web/src/app/\(docs\)/docs/api-reference/js-sdk/filesystem/page.mdx
#
#mkdir -p ../../apps/web/src/app/\(docs\)/docs/api-reference/js-sdk/process
#mv api_ref/sandbox/process.md ../../apps/web/src/app/\(docs\)/docs/api-reference/js-sdk/process/page.mdx
#
#mkdir -p ../../apps/web/src/app/\(docs\)/docs/api-reference/js-sdk/pty
#mv api_ref/sandbox/pty.md ../../apps/web/src/app/\(docs\)/docs/api-reference/js-sdk/pty/page.mdx
#
#rm -rf api_ref

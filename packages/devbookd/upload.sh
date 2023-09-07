#!/bin/bash

set -euo pipefail

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp dist/devbookd_linux_amd64_v1/devbookd gs://e2b-fc-env-pipeline/devbookd

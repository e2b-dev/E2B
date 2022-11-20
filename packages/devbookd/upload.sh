#!/bin/bash

set -euo pipefail

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp dist/devbookd_linux_amd64_v1 gs://devbook-environment-pipeline/devbookd

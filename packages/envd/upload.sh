#!/bin/bash

set -euo pipefail

chmod +x dist/envd_linux_amd64_v1/envd

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp dist/envd_linux_amd64_v1/envd gs://e2b-fc-env-pipeline/envd

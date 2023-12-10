#!/bin/bash

set -euo pipefail

GCP_PROJECT_ID=$1

chmod +x dist/envd_linux_amd64_v1/envd

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp dist/envd_linux_amd64_v1/envd "gs://${GCP_PROJECT_ID}-fc-env-pipeline/envd"

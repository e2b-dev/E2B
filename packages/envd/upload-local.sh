#!/bin/bash

set -euo pipefail

GCP_PROJECT_ID=$1

chmod +x bin/envd

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/envd "gs://${GCP_PROJECT_ID}-fc-env-pipeline/envd-v2"

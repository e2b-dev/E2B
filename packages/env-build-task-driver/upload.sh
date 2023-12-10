#!/bin/bash

set -euo pipefail

GCP_PROJECT_ID=$1

chmod +x bin/env-build-task-driver

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/env-build-task-driver "gs://${GCP_PROJECT_ID}-fc-env-pipeline/env-build-task-driver"

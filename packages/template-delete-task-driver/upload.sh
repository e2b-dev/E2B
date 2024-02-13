#!/bin/bash

set -euo pipefail

GCP_PROJECT_ID=$1

chmod +x bin/template-delete-task-driver

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/template-delete-task-driver "gs://${GCP_PROJECT_ID}-fc-env-pipeline/template-delete-task-driver"

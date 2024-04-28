#!/bin/bash

set -euo pipefail

GCP_PROJECT_ID=$1

chmod +x bin/template-manager

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/template-manager "gs://${GCP_PROJECT_ID}-fc-env-pipeline/template-manager"

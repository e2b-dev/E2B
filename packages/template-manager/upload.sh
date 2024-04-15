#!/bin/bash

set -euo pipefail

GCP_PROJECT_ID=$1

#TODO:
chmod +x bin/orchestrator

#TODO:
gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/orchestrator "gs://${GCP_PROJECT_ID}-fc-env-pipeline/orchestrator"

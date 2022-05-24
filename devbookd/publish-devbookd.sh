#!/bin/bash

# This script uploads the devbookd daemon to a GCS bucket.
# The `firecracker-envs` Nomad job then downloads the daemon from bucket every time it runs and is making a new environment.

set -euo pipefail

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/devbookd gs://devbook-environment-pipeline

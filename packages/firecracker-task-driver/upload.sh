#!/bin/bash

set -euo pipefail

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/firecracker-task-driver gs://e2b-fc-env-pipeline/firecracker-task-driver

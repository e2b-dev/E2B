#!/bin/bash

set -euo pipefail

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/fc-instance-task-driver gs://e2b-fc-env-pipeline/fc-instance-task-driver

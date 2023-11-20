#!/bin/bash

set -euo pipefail

chmod +x bin/env-delete-task-driver

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/env-delete-task-driver gs://e2b-fc-env-pipeline/env-delete-task-driver

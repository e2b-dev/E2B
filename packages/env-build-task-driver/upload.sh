#!/bin/bash

set -euo pipefail

chmod +x bin/env-build-task-driver

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/env-build-task-driver gs://e2b-fc-env-pipeline/env-build-task-driver

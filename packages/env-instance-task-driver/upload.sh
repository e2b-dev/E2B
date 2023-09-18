#!/bin/bash

set -euo pipefail

chmod +x bin/env-instance-task-driver

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/env-instance-task-driver gs://e2b-fc-env-pipeline/env-instance-task-driver

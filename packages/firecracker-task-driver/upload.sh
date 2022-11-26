#!/bin/bash

set -euo pipefail

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/firecracker-task-driver gs://devbook-environment-pipeline/firecracker-task-driver

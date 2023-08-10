#!/bin/bash

set -euo pipefail

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/devbookd gs://devbook-environment-pipeline/devbookd

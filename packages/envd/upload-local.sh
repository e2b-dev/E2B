#!/bin/bash

set -euo pipefail

chmod +x bin/envd

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp bin/envd gs://e2b-fc-env-pipeline/envd

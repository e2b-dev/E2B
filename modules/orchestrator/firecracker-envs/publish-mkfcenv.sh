#!/bin/bash

# This script zips the `mkfcenv` directory and uploads it to a GCS bucket.
# The `firecracker-envs` Nomad job then downloads the zipped directory from the bucket every time it runs and is making a new environment.

set -euo pipefail

tar czf mkenv.tar.gz mkfcenv

gsutil -h "Cache-Control:no-cache, max-age=0" cp mkenv.tar.gz gs://devbook-environment-pipeline

rm mkenv.tar.gz

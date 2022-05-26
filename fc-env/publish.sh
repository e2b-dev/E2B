#!/bin/bash

# This script zips the `mkfcenv` directory and uploads it to a GCS bucket.
# The `firecracker-envs` Nomad job then downloads the zipped directory from the bucket every time it runs and is making a new environment.

set -euo pipefail

mkdir env

mv devbookd/bin/devbookd env
cp ./build-env.sh ./env/
cp ./provision-env.sh ./env/

tar czf env.tar.gz env

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp env.tar.gz gs://devbook-environment-pipeline

rm env.tar.gz
rm -rf env

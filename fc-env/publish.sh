#! /bin/bash

# This script creates and uploads the `env` directory to a GCS bucket.
# The `firecracker-envs` Nomad job then downloads the zipped directory from the bucket every time it runs.

set -euo pipefail

rm env.tar.gz
rm -rf env

mkdir env

mv devbookd/bin/devbookd env
cp ./devbookd-init ./env/
cp ./build-env.sh ./env/
cp ./provision-env.sh ./env/

tar czf env.tar.gz env

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp env.tar.gz gs://devbook-environment-pipeline

rm env.tar.gz
rm -rf env

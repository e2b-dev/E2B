#! /bin/bash

# This script creates and uploads the `env` directory to a GCS bucket.
# The `firecracker-envs` Nomad job then downloads the zipped directory from the bucket every time it runs.

set -euo pipefail

[ -e env.tar.gz ] && rm env.tar.gz
[ -d env ] && rm -rf env

mkdir env

cp -r alpine env/
cp -r ubuntu env/

cp build-env.sh env/
cp use-prebuilt-env.sh env/
cp update-env.sh env/

tar czf env.tar.gz env

echo Packaged env pipelines

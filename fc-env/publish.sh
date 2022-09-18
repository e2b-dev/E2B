#! /bin/bash

# This script creates and uploads the `env` directory to a GCS bucket.
# The `firecracker-envs` Nomad job then downloads the zipped directory from the bucket every time it runs.

set -euo pipefail

[ -e env.tar.gz ] && rm env.tar.gz
[ -d env ] && rm -rf env

mkdir env

# Download latest release of devbookd.
os="Linux"
arch="x86_64"
exe="env/devbookd"
devbookd_uri="https://github.com/devbookhq/devbookd/releases/latest/download/devbookd_${os}_${arch}.tar.gz"
curl --fail --location --progress-bar --output "$exe.tar.gz" "$devbookd_uri"
tar xzf "$exe.tar.gz" -C env
chmod +x "$exe"
rm "$exe.tar.gz"

cp -r alpine env/
cp -r ubuntu env/

cp build-env.sh env/
cp use-prebuilt-env.sh env/
cp update-env.sh env/

tar czf env.tar.gz env

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp env.tar.gz gs://devbook-environment-pipeline

rm env.tar.gz
rm -rf env

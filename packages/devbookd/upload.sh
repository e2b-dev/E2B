#!/bin/bash

set -euo pipefail

[ -e devbookd-env.tar.gz ] && rm env.tar.gz
[ -d devbookd-env ] && rm -rf env

mkdir devbookd-env

cp dist/devbookd_linux_amd64_v1 devbookd-env/devbookd

tar czf devbookd-env.tar.gz devbookd-env

gsutil -h "Cache-Control:no-cache, max-age=0" \
  cp c.tar.gz gs://devbook-environment-pipeline

rm devbookd-env.tar.gz
rm -rf devbookd-env

#!/bin/bash

set -euo pipefail

GCP_PROJECT_ID=$1

# Check if the file exists
if [ -f "firecracker_versions.txt" ]; then
  while IFS= read -r version; do

    # Upload kernel to GCP bucket
    gsutil -h "Cache-Control:no-cache, max-age=0" cp -r "builds/${version}" "gs://${GCP_PROJECT_ID}-fc-versions"

    rm -rf "builds/${firecracker_version}"
  done <"firecracker_versions.txt"

  echo "All FC versions uploaded to GCP bucket successfully."
else
  echo "Error: firecracker_versions.txt not found."
fi

rm -rf builds/*

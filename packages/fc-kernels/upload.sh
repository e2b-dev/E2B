#!/bin/bash

set -euo pipefail

GCP_PROJECT_ID=$1

mkdir -p downloads
rm -rf downloads/*

# Check if the file exists
if [ -f "kernel_versions.txt" ]; then
  # Read kernel versions from the file
  while IFS= read -r version; do
    # Download kernel
    echo "Downloading kernel ${version}..."
    mkdir -p "downloads/vmlinux-${version}"
    curl "https://s3.amazonaws.com/spec.ccfc.min/firecracker-ci/${version}/x86_64/vmlinux-${version}" -o "downloads/vmlinux-${version}/vmlinux.bin"

    # Upload kernel to GCP bucket
    gsutil -h "Cache-Control:no-cache, max-age=0" cp -n -r "downloads/vmlinux-${version}" "gs://${GCP_PROJECT_ID}-fc-kernels"

    rm -rf "downloads/${version}"
  done <"kernel_versions.txt"

  echo "All kernels downloaded and uploaded to GCP bucket successfully."
else
  echo "Error: kernel_versions.txt not found."
fi

rm -rf downloads/*

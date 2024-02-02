#!/bin/bash

set -euo pipefail

GCP_PROJECT_ID=$1

FC_VERSION="v1.7"

mkdir -p downloads
rm -rf downloads/*

# Check if the file exists
if [ -f "kernel_versions.txt" ]; then
  # Read kernel versions from the file
  while IFS= read -r version; do
    # Download kernel

    stringarray=($version)
    fc_version=${stringarray[0]}
    kernel_version=${stringarray[1]}

    echo "Downloading kernel ${kernel_version}..."
    mkdir -p "downloads/vmlinux-${kernel_version}"
    curl --fail "https://s3.amazonaws.com/spec.ccfc.min/firecracker-ci/${fc_version}/x86_64/vmlinux-${kernel_version}" -o "downloads/vmlinux-${kernel_version}/vmlinux.bin"

    # Upload kernel to GCP bucket
    gsutil -h "Cache-Control:no-cache, max-age=0" cp -r "downloads/vmlinux-${kernel_version}" "gs://${GCP_PROJECT_ID}-fc-kernels"

    rm -rf "downloads/${kernel_version}"
  done <"kernel_versions.txt"

  echo "All kernels downloaded and uploaded to GCP bucket successfully."
else
  echo "Error: kernel_versions.txt not found."
fi

rm -rf downloads/*

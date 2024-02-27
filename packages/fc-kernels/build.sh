#!/bin/bash

set -euo pipefail

function build_version {
  local version=$1
  echo "Starting build for kernel version: $version"

  cp ../configs/"${version}.config" .config

  echo "Checking out repo for kernel at version: $version"
  git fetch --depth 1 origin "v${version}"
  git checkout FETCH_HEAD

  echo "Building kernel version: $version"
  make vmlinux -j "$(nproc)"

  echo "Copying finished build to builds directory"
  mkdir -p "../builds/vmlinux-${version}"
  cp vmlinux "../builds/vmlinux-${version}/vmlinux.bin"
}

echo "Cloning the linux kernel repository"
git clone --depth 1 https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git linux
cd linux

grep -v '^ *#' <../kernel_versions.txt | while IFS= read -r version; do
  build_version "$version"
done

cd ..
rm -rf linux

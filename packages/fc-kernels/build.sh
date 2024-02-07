#!/bin/bash

set -euo pipefail

function build_version {
  local version=$1
  echo "Starting build for kernel version: $version"

  stringarray=($version)
  kernel_version=${stringarray[1]}

  cp ../configs/"${kernel_version}.config" .config

  echo "Checking out repo for kernel at version: $kernel_version"
  git checkout "v${kernel_version}"

  echo "Building kernel version: $kernel_version"
  make vmlinux -j "$(nproc)"

  echo "Copying finished build to builds directory"
  mkdir -p "../builds/vmlinux-${kernel_version}"
  cp vmlinux "../builds/vmlinux-${kernel_version}/vmlinux.bin"
}


git clone --depth 1 https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git linux
cd linux
git fetch --tags

grep -v '^ *#' < ../kernel_versions.txt | while IFS= read -r version
do
  build_version "$version"
done

cd ..
rm -rf linux

#!/bin/bash

set -euo pipefail

function build_version {
  local version=$1
  stringarray=($version)
  kernel_version=${stringarray[1]}

  cp ../configs/"${kernel_version}.config" .config

  git checkout "v${kernel_version}"

  make vmlinux -j "$(nproc)"

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

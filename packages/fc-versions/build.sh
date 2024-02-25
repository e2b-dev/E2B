#!/bin/bash

set -euo pipefail

function build_version {
  local version=$1
  echo "Starting build for Firecracker commit: $version"

  echo "Checking out repo for Firecracker at commit: $version"
  git checkout "${version}"

  # The format will be: latest_tag_latest_commit_hash — v1.7.0-dev_g8bb88311
  version_name=$(git describe --tags --abbrev=0 $(git rev-parse HEAD))_$(git rev-parse --short HEAD)
  echo "Version name: $version_name"

  echo "Building Firecracker version: $version_name"
  tools/devtool -y build --release

  echo "Copying finished build to builds directory"
  mkdir -p "../builds/${version_name}"
  cp build/cargo_target/x86_64-unknown-linux-musl/release/firecracker "../builds/${version_name}/firecracker"

  # The following command needs cmake and libclang-dev
  # It builds the defautl UFFD
  cargo build --example uffd_valid_handler --release
  cp build/cargo_target/release/examples/uffd_valid_handler "../builds/${version_name}/uffd"
}

echo "Cloning the Firecracker repository"
git clone https://github.com/firecracker-microvm/firecracker.git firecracker
cd firecracker

grep -v '^ *#' <../firecracker_versions.txt | while IFS= read -r version; do
  build_version "$version"
done

cd ..
rm -rf firecracker

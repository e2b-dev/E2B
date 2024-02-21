#!/bin/bash

set -euo pipefail

function build_version {
  local version=$1
  echo "Starting build for Firecracker commit: $version"

  echo "Checking out repo for Firecracker at commit: $version"
  git checkout "${version}"

  # The format will be: latest_tag-number_of_commits_since-latest_commit_hash — v1.7.0-dev-252-g8bb88311
  version_name=$(git describe --tag)
  echo "Version name: $version_name"

  echo "Building Firecracker version: $version_name"
  tools/devtool -y build --release

  echo "Copying finished build to builds directory"
  mkdir -p "../builds/${version_name}"
  cp build/cargo_target/x86_64-unknown-linux-musl/release/firecracker "../builds/${version_name}/firecracker"
}

echo "Cloning the Firecracker repository"
git clone https://github.com/firecracker-microvm/firecracker.git firecracker
cd firecracker

grep -v '^ *#' <../firecracker_versions.txt | while IFS= read -r version; do
  build_version "$version"
done

cd ..
rm -rf firecracker

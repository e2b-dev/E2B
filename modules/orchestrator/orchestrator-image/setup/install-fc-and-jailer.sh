#!/bin/bash

set -e

function install {
  git clone https://github.com/firecracker-microvm/firecracker

  cd firecracker

  sudo tools/devtool -y build

  sudo cp build/cargo_target/x86_64-unknown-linux-musl/debug/firecracker /usr/local/bin/firecracker
  sudo cp build/cargo_target/x86_64-unknown-linux-musl/debug/jailer /usr/local/bin/jailer
}

install "$@"

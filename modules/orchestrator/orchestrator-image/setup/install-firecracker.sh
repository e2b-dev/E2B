#!/bin/bash

set -e

function install {
  local version="latest"

  while [[ $# -gt 0 ]]; do
    local key="$1"

    case "$key" in
      --version)
        version="$2"
        shift
        ;;
      *)
        log_error "Unrecognized argument: $key"
        print_usage
        exit 1
        ;;
    esac

    shift
  done

  release_url="https://github.com/firecracker-microvm/firecracker/releases"

  selected=$(basename $(curl -fsSLI -o /dev/null -w  %{url_effective} ${release_url}/${version}))
  # We way want to use older version because of a bug in FC task driver
  arch=`uname -m`
  curl -L ${release_url}/download/${selected}/firecracker-${selected}-${arch}.tgz \
  | tar -xz

  sudo mv release-${selected}-$(uname -m)/firecracker-${selected}-$(uname -m) /usr/local/bin/firecracker
  sudo mv release-${selected}-$(uname -m)/jailer-${selected}-$(uname -m) /usr/local/bin/jailer
}

install "$@"

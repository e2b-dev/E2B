#!/bin/bash
# This script can be used to install Consul and its dependencies. This script has b
een tested with the following
# operating systems:
#
# - Ubuntu 18.04

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

  curl -L https://func-e.io/install.sh | sudo bash -s -- -b /usr/local/bin
  func-e use ${version}
  sudo cp ~/.func-e/versions/1.18.3/bin/envoy /usr/local/bin/
}

install "$@"
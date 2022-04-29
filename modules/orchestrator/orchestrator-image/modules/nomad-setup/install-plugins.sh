#!/bin/bash
# This script can be used to install Nomad and its dependencies. This script has been tested with the following
# operating systems:
#
# 1. Ubuntu 16.04
# 2. Ubuntu 18.04

set -e

function install {
  go get github.com/cneira/firecracker-task-driver
  mkdir plugins
  cp ~/go/bin/firecracker-task-driver plugins/

  git clone https://github.com/containernetworking/plugins.git cni-plugins
  cd cni-plugins
  ./build_linux.sh
  sudo mkdir -p /opt/cni/bin
  sudo cp bin/* /opt/cni/bin/

}

install
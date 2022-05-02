#!/bin/bash

set -e

function install {
  go install github.com/cneira/firecracker-task-driver@latest
  sudo mkdir -p /opt/nomad/plugins
  sudo cp ~/go/bin/firecracker-task-driver /opt/nomad/plugins/firecracker-task-driver  
}

install

packer {
  required_version = ">= 1.8.0"
  required_plugins {
    googlecompute = {
      version = ">= 1.0.11"
      source  = "github.com/hashicorp/googlecompute"
    }
  }
}

# TODO: Separate server and client images
source "googlecompute" "orch" {
  image_family        = "orch"
  # TODO: Overwrite the image instead of creating timestamped images every time we build its
  image_name          = "orch-${formatdate("YYYY-MM-DD-hh-mm-ss", timestamp())}"
  project_id          = var.gcp_project_id
  source_image_family = "ubuntu-2004-lts"
  ssh_username        = "ubuntu"
  zone                = var.gcp_zone
  disk_size           = 10
  disk_type           = "pd-ssd"

  # This is used only for building the image and the GCE VM is then deleted
  machine_type = "n1-standard-4"

  # Enable nested virtualization
  image_licenses = ["projects/vm-options/global/licenses/enable-vmx"]
}

build {
  sources = ["source.googlecompute.orch"]

  provisioner "file" {
    source      = "${path.root}/setup/supervisord.conf"
    destination = "/tmp/supervisord.conf"
  }

  provisioner "file" {
    source      = "${path.root}/setup"
    destination = "/tmp"
  }

  # TODO: Remove unused deps
  provisioner "shell" {
    inline = [
      "sudo add-apt-repository ppa:longsleep/golang-backports",
      "sudo apt-get update",
      "sudo apt-get install -y unzip jq golang-go build-essential net-tools qemu-utils",
    ]
  }
  
  # Install Docker
  provisioner "shell" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y docker.io",
      "sudo systemctl start docker",
      "sudo usermod -aG docker $USER",
    ]
  }
  
  # TODO: Remove unused deps
  provisioner "shell" {
    inline = [
      "sudo mkdir -p /opt/gruntwork",
      "git clone --branch v0.1.3 https://github.com/gruntwork-io/bash-commons.git /tmp/bash-commons",
      "sudo cp -r /tmp/bash-commons/modules/bash-commons/src /opt/gruntwork/bash-commons",
    ]
  }

  provisioner "shell" {
    script          = "${path.root}/setup/install-consul.sh"
    execute_command = "chmod +x {{ .Path }}; {{ .Vars }} {{ .Path }} --version ${var.consul_version}"
  }

  # TODO: Remove unused deps - is Consul already using dnsmasq?
  provisioner "shell" {
    script          = "${path.root}/setup/install-dnsmasq.sh"
  }

  provisioner "shell" {
    script          = "${path.root}/setup/install-nomad.sh"
    execute_command = "chmod +x {{ .Path }}; {{ .Vars }} {{ .Path }} --version ${var.nomad_version}"
  }

  provisioner "shell" {
    script          = "${path.root}/setup/install-firecracker.sh"
    execute_command = "chmod +x {{ .Path }}; {{ .Vars }} {{ .Path }} --version ${var.firecracker_version}"
  }

  provisioner "file" {
    source      = "${path.root}/firecracker-task-driver"
    destination = "/tmp"
  }

  provisioner "shell" {
    inline = [
      "cd /tmp/firecracker-task-driver",
      "make init",
      "make build",
      "sudo mkdir -p /opt/nomad/plugins",
      "sudo cp /tmp/firecracker-task-driver/bin/firecracker-task-driver /opt/nomad/plugins/firecracker-task-driver",
    ]
  }

  # TODO: Remove testing snapshots and bucket after we have envs pipeline ready
  provisioner "shell" {
    inline = [
      "sudo mkdir -p /fc-vm",
      "sudo curl https://storage.googleapis.com/devbook-snapshot/vmlinux.bin -o /fc-vm/vmlinux.bin",
      "sudo curl https://storage.googleapis.com/devbook-snapshot/mem_file -o /fc-vm/mem_file",
      "sudo curl https://storage.googleapis.com/devbook-snapshot/rootfs.ext4 -o /fc-vm/rootfs.ext4",
      "sudo curl https://storage.googleapis.com/devbook-snapshot/snapshot_file -o /fc-vm/snapshot_file",
    ]
  }
}

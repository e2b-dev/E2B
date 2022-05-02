packer {
  required_version = ">= 1.8.0"
  required_plugins {
    googlecompute = {
      version = ">= 1.0.11"
      source  = "github.com/hashicorp/googlecompute"
    }
  }
}

source "googlecompute" "orch" {
  image_family        = "orch"
  image_name          = "orch-${formatdate("YYYY-MM-DD-hh-mm-ss", timestamp())}"
  project_id          = var.gcp_project_id
  source_image_family = "ubuntu-2004-lts"
  ssh_username        = "ubuntu"
  zone                = var.gcp_zone
  disk_size           = 10

  # This is used only for building the image and the GCE VM is then deleted
  machine_type = "n1-standard-2"

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

  provisioner "shell" {
    inline = [
      "sudo add-apt-repository ppa:longsleep/golang-backports",
      "sudo apt-get update",
      "sudo apt-get install -y unzip jq golang-go build-essential",
    ]
  }

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

  # provisioner "shell" {
  #   script          = "${path.root}/setup/install-dnsmasq.sh"
  # }

  provisioner "shell" {
    script          = "${path.root}/setup/install-nomad.sh"
    execute_command = "chmod +x {{ .Path }}; {{ .Vars }} {{ .Path }} --version ${var.nomad_version}"
  }

  provisioner "shell" {
   script          = "${path.root}/setup/install-firecracker.sh"
   execute_command = "chmod +x {{ .Path }}; {{ .Vars }} {{ .Path }} --version ${var.firecracker_version}"
  }

  provisioner "shell" {
    script          = "${path.root}/setup/install-fc-driver.sh"
  }

  provisioner "shell" {
    script          = "${path.root}/setup/install-cni-plugins.sh"
  }

  # Add testing FC kernel and rootfs
  provisioner "shell" {
   inline = [
     "sudo mkdir -p /fc-vm",
     "sudo mkdir -p /fc-envs",
     "sudo curl https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/kernels/vmlinux.bin -o /fc-vm/vmlinux.bin",
     "sudo mkdir -p /fc-envs/test",
     "sudo curl https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/rootfs/bionic.rootfs.ext4 -o /fc-envs/test/rootfs.ext4",
   ]
  }
}

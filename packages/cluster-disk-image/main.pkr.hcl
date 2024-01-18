packer {
  required_version = ">=1.8.4"
  required_plugins {
    googlecompute = {
      version = "1.0.16"
      source  = "github.com/hashicorp/googlecompute"
    }
  }
}

# TODO: Separate server and client images
source "googlecompute" "orch" {
  image_family = "e2b-orch"
  # TODO: Overwrite the image instead of creating timestamped images every time we build its
  image_name          = "e2b-orch-${formatdate("YYYY-MM-DD-hh-mm-ss", timestamp())}"
  project_id          = var.gcp_project_id
  source_image_family = "ubuntu-2204-lts"
  ssh_username        = "ubuntu"
  zone                = var.gcp_zone
  disk_size           = 10
  disk_type           = "pd-ssd"

  # This is used only for building the image and the GCE VM is then deleted
  machine_type = "n2-standard-2"

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

  provisioner "file" {
    source      = "${path.root}/setup/docker-daemon.json"
    destination = "/etc/docker/daemon.json"
  }

  # Install Docker
  provisioner "shell" {
    inline = [
      "sudo curl -fsSL https://get.docker.com -o get-docker.sh",
      "sudo sh get-docker.sh",
    ]
  }

  provisioner "shell" {
    inline = [
      "export GCSFUSE_REPO=gcsfuse-`lsb_release -c -s`",
      "echo \"deb https://packages.cloud.google.com/apt $GCSFUSE_REPO main\" | sudo tee /etc/apt/sources.list.d/gcsfuse.list",
      "curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -",
    ]
  }


  # TODO: Remove unused deps
  provisioner "shell" {
    inline = [
      "sudo apt-get update",
      "sudo apt-get install -y unzip jq net-tools qemu-utils gcsfuse make build-essential",
    ]
  }

  provisioner "shell" {
    inline = [
      "sudo snap install go --classic"
    ]
  }

  provisioner "shell" {
    inline = [
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
  # provisioner "shell" {
  #   script = "${path.root}/setup/install-dnsmasq.sh"
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
    inline = [
      "sudo mkdir -p /fc-vm",
      "sudo curl https://s3.amazonaws.com/spec.ccfc.min/firecracker-ci/v1.5/x86_64/vmlinux-${var.kernel_version} -o /fc-vm/vmlinux.bin",
    ]
  }

  provisioner "shell" {
    inline = [
      "sudo mkdir -p /opt/nomad/plugins",
    ]
  }

  provisioner "file" {
    source      = "${path.root}/setup/gc-ops.config.yaml"
    destination = "/tmp/gc-ops.config.yaml"
  }

  provisioner "shell" {
    inline = [
      "sudo curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh",
      "sudo bash add-google-cloud-ops-agent-repo.sh --also-install",
      "sudo mkdir -p /etc/google-cloud-ops-agent",
      "sudo mv /tmp/gc-ops.config.yaml /etc/google-cloud-ops-agent/config.yaml",
    ]
  }
}

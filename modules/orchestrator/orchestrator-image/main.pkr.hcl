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
  disk_size           = 20
  disk_type           = "pd-ssd"

  # This is used only for building the image and the GCE VM is then deleted
  machine_type = "n1-standard-4"

  # Enable nested virtualization
  image_licenses = ["projects/vm-options/global/licenses/enable-vmx"]
}

source "googlecompute" "orch_dev" {
  image_family        = "orch-dev"
  image_name          = "orch-dev-${formatdate("YYYY-MM-DD-hh-mm-ss", timestamp())}"
  project_id          = var.gcp_project_id
  source_image_family = "orch"
  ssh_username        = "ubuntu"
  zone                = var.gcp_zone
  disk_size           = 20
  disk_type           = "pd-ssd"

  # This is used only for building the image and the GCE VM is then deleted
  machine_type = "n1-standard-2"

  # Enable nested virtualization
  image_licenses = ["projects/vm-options/global/licenses/enable-vmx"]
}

build {
  # sources = ["source.googlecompute.orch_dev"]

  provisioner "file" {
    source      = "${path.root}/../firecracker-task-driver"
    destination = "/tmp"
  }

  provisioner "shell" {
    inline = [
      "cd /tmp/firecracker-task-driver",
      "make init",
      "GOOS=linux go build -a -o bin/ .",
      "sudo mkdir -p /opt/nomad/plugins",
      "sudo cp /tmp/firecracker-task-driver/bin/firecracker-task-driver /opt/nomad/plugins/firecracker-task-driver",
    ]
  }
}

build {
  # DEV ONLY - WE ARE NOT BUILDING THE WHOLE IMAGE BECAUSE IT TOOK TOO LONG FOR TASK DRIVER DEVELOPMENT
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
  
  # Install Docker
  # provisioner "shell" {
  #   inline = [
  #     "sudo apt-get update",
  #     "sudo apt-get install -y docker.io",
  #     "sudo systemctl start docker",
  #     "sudo usermod -aG docker $USER",
  #   ]
  # }
  
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

  # provisioner "shell" {
  #   script          = "${path.root}/setup/install-fc-and-jailer.sh"
  # }

  provisioner "file" {
    source      = "${path.root}/../firecracker-task-driver"
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

  provisioner "shell" {
    script          = "${path.root}/setup/install-cni-plugins.sh"
  }

  # Add testing FC kernel and rootfs
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

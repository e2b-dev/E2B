packer {
  required_version = ">= 1.8.0"
  required_plugins {
    googlecompute = {
      version = ">= 1.0.11"
      source  = "github.com/hashicorp/googlecompute"
    }
  }
}

source "googlecompute" "fc_envs_disk_image" {
  image_family        = "fc-envs"
  image_name          = "fc-envs-${formatdate("YYYY-MM-DD-hh-mm-ss", timestamp())}"
  project_id          = var.gcp_project_id
  source_image_family = "ubuntu-2004-lts"
  ssh_username        = "ubuntu"
  zone                = var.zone
  disk_size           = 30

  # This is used only for building the image and the GCE VM is then deleted
  machine_type = "n1-standard-2"
}

build {
  sources = ["source.googlecompute.fc_envs_disk_image"]

  provisioner "shell" {
    inline = [
      "sudo mkdir -p /fc-vm",
      "sudo mkdir -p /fc-envs",
    ]
  }

  provisioner "shell" {
    inline = [
      "sudo curl https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/kernels/vmlinux.bin -o /fc-vm/vmlinux.bin",
      "sudo mkdir -p /fc-envs/test",
      "sudo curl https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/rootfs/bionic.rootfs.ext4 -o /fc-envs/test/rootfs.ext4",
    ]
  }
}

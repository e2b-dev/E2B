packer {
  required_version = ">= 1.8.0"
  required_plugins {
    googlecompute = {
      version = ">= 1.0.11"
      source  = "github.com/hashicorp/googlecompute"
    }
  }
}

# The "legacy_isotime" function has been provided for backwards compatability, but we recommend switching to the timestamp and formatdate functions.
source "googlecompute" "ubuntu20-image" {
  image_family        = "fc-init"
  image_name          = "fc-init-ubuntu20-${legacy_isotime("2006-01-02-030405")}"
  project_id          = var.project_id
  source_image_family = "ubuntu-2004-lts"
  ssh_username        = "ubuntu"
  zone                = var.zone
  disk_size           = 20

  # This is used only for building the image and the GCE VM is then deleted
  machine_type        = "n1-standard-2"
  
  # Enable nested virtualization
  image_licenses = ["projects/vm-options/global/licenses/enable-vmx"]
}

# Avoid mixing go templating calls ( for example ```{{ upper(`string`) }}``` )
# and HCL2 calls (for example '${ var.string_value_example }' ). They won't be
# executed together and the outcome will be unknown.
build {
  sources = ["source.googlecompute.ubuntu20-image"]

  provisioner "shell" {
    inline = ["mkdir -p /fc-bundles/1", "mkdir -p /fc-vm"]
  }

  provisioner "shell" {
    script          = "./download-vm.sh"
  }

  provisioner "shell" {
    script          = "./download-rootfs.sh"
  }
}

packer {
  required_version = ">= 1.8.0"
}

# The "legacy_isotime" function has been provided for backwards compatability, but we recommend switching to the timestamp and formatdate functions.
source "googlecompute" "ubuntu20-image" {
  image_family        = "orch"
  image_name          = "orch-ubuntu20-${legacy_isotime("2006-01-02-030405")}"
  project_id          = var.project_id
  source_image_family = "ubuntu-2004-lts"
  ssh_username        = "ubuntu"
  zone                = var.zone

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

  provisioner "file" {
    source = "./modules/nomad-setup/supervisord.conf"
    destination = "/tmp/supervisord.conf"
  }

  provisioner "file" {
    source = "./modules/"
    destination = "/tmp"
  }

  provisioner "shell" {
    inline = ["sudo apt update", "sudo apt install -y unzip jq"]
  }

  provisioner "shell" {
    inline = [
      "sudo mkdir -p /opt/gruntwork",
      "git clone --branch v0.1.3 https://github.com/gruntwork-io/bash-commons.git /tmp/bash-commons",
      "sudo cp -r /tmp/bash-commons/modules/bash-commons/src /opt/gruntwork/bash-commons",
    ]
  }

  provisioner "shell" {
    script          = "./modules/nomad-setup/install-nomad.sh"
    execute_command = "chmod +x {{ .Path }}; {{ .Vars }} {{ .Path }} --version ${var.nomad_version}"
  }

  provisioner "shell" {
    script          = "./modules/consul-setup/install-consul.sh"
    execute_command = "chmod +x {{ .Path }}; {{ .Vars }} {{ .Path }} --version ${var.consul_version}"
  }

  provisioner "shell" {
    script          = "./modules/firecracker-setup/install-firecracker.sh"
    execute_command = "chmod +x {{ .Path }}; {{ .Vars }} {{ .Path }} --version ${var.firecracker_version}"
  }
}

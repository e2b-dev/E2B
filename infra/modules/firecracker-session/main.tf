# TODO: Add correct address
provider "nomad" {
  address = "http://localhost:4646"
}

variable "rootfs_path" {
  description = "Must be an absolute path"
  type        = string
  default     = "/rootfs.ext4"
}

variable "kernel_path" {
  description = "Must be an absolute path"
  type        = string
  default     = "/vmlinux"
}

variable "firecracker_path" {
  description = "Must be an absolute path"
  type        = string
  default     = "/usr/local/bin/firecracker"
}

# Register a job
resource "nomad_job" "firecracker_session" {
  jobspec = file("${path.module}/firecracker-session.hcl.tmpl")

  hcl2 {
    enabled = true
    vars = {
      rootfs_path      = var.rootfs_path
      kernel_path      = var.kernel_path
      firecracker_path = var.firecracker_path
    }
  }
}

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

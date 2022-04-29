variable "rootfs_path" {
  description = "Must be an absolute path"
  type        = string
  default     = "/fc-envs/test/rootfs.ext4"
}

variable "kernel_path" {
  description = "Must be an absolute path"
  type        = string
  default     = "/fc-vm/vmlinux.bin"
}

variable "firecracker_path" {
  description = "Must be an absolute path"
  type        = string
  default     = "/usr/local/bin/firecracker"
}

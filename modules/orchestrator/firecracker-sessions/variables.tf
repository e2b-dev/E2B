variable "memfile_path" {
  description = "Must be an absolute path"
  type        = string
  default     = "/fc-vm/mem_file"
}

variable "snapshot_path" {
  description = "Must be an absolute path"
  type        = string
  default     = "/fc-vm/snapshot_file"
}

variable "firecracker_path" {
  description = "Must be an absolute path"
  type        = string
  default     = "/usr/local/bin/firecracker"
}

variable "gcp_zone" {
  type = string
}

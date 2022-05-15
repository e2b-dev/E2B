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

variable "gcp_zone" {
  type = string
}

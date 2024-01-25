variable "gcp_project_id" {
  type    = string
}

variable "gcp_zone" {
  type    = string
}

variable "consul_version" {
  type    = string
  default = "1.16.2"
}

variable "nomad_version" {
  type    = string
  default = "1.6.2"
}

variable "firecracker_version" {
  type        = string
  description = "Firecracker version must be prefixed with 'v'"
  default     = "v1.5.0"
}

variable "kernel_version" {
  type = string
  description = "Kernel version"
  default = "6.1.68"
}

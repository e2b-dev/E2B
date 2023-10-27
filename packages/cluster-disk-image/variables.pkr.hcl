variable "gcp_project_id" {
  type    = string
  default = "e2b-prod"
}

variable "gcp_zone" {
  type    = string
  default = "us-central1-c"
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
  default = "5.10.186"
}

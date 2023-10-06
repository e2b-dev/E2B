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
  default = "1.12.0"
}

variable "nomad_version" {
  type    = string
  default = "1.3.0"
}

variable "firecracker_version" {
  type        = string
  description = "Firecracker version must be prefixed with 'v'"
  default     = "v1.4.1"
}

variable "kernel_version" {
  type = string
  description = "Kernel version"
  default = "5.10.186"
}

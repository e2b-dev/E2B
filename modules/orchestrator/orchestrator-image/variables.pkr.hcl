variable "gcp_project_id" {
  type    = string
  default = "devbookhq"
}

variable "gcp_zone" {
  type    = string
  default = "us-central1-a"
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
  default     = "v1.0.0"
}

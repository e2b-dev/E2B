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
  default = "1.2.6"
}

# There is a bug with Nomad's FC task driver for FC v1.0.0 - until it is fixed we can use v0.25.2
variable "firecracker_version" {
  type    = string
  default = "v0.25.2"
}

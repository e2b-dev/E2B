variable "gcp_project_id" {
  type = string
}

variable "gcp_zone" {
  type = string
}

variable "consul_version" {
  type    = string
  default = "1.16.2"
}

variable "nomad_version" {
  type    = string
  default = "1.6.2"
}

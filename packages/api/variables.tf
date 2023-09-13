variable "gcp_zone" {
  type = string
}

variable "nomad_address" {
  type = string
}

variable "consul_token" {
  type = string
}

variable "nomad_token" {
  type = string
}

variable "api_port" {
  type = object({
    name        = string
    port        = number
    health_path = string
    health_path = string
  })
}

variable "image_name" {
  type    = string
  default = "us-central1-docker.pkg.dev/e2b-prod/orchestration/api"
}

variable "logs_proxy_address" {
  type = string
}

variable "environment" {
  type = string
}

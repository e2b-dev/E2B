variable "gcp_zone" {
  type = string
}

variable "nomad_address" {
  type = string
}

variable "api_port" {
  type = object({
    name        = string
    port        = number
    health_path = string
  })
}

variable "image_name" {
  type    = string
  default = "us-central1-docker.pkg.dev/devbookhq/orchestration/api"
}

variable "logs_proxy_address" {
  type = string
}

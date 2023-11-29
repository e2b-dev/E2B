variable "gcp_zone" {
  type = string
}

variable "client_proxy_health_port" {
  type = object({
    name = string
    port = number
    path = string
  })
}

variable "session_proxy_service_name" {
  type = string
}

variable "client_proxy_port" {
  type = object({
    name = string
    port = number
  })
}

variable "domain_name" {
  type = string
}
variable "gcp_zone" {
  type = string
}

variable "client_cluster_size" {
  type = number
}

variable "session_proxy_service_name" {
  type = string
}

variable "session_proxy_port" {
  type    = object({
    name = string
    port = number
  })
}
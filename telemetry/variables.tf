variable "gcp_zone" {
  type = string
}

variable "lightstep_api_key" {
  type = string
}

variable "logs_proxy_port" {
  type = object({
    name = string
    port = number
  })
}

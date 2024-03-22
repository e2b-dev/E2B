variable "prefix" {
  type = string
}
variable "domain_name" {
  type = string
}

variable "cluster_tag_name" {
  type = string
}

variable "network_name" {
  type = string
}

variable "gcp_project_id" {
  type = string
}


variable "api_port" {
  type = object({
    name        = string
    port        = number
    health_path = string
  })
}

variable "docker_reverse_proxy_port" {
  type = object({
    name        = string
    port        = number
    health_path = string
  })
}

variable "client_proxy_health_port" {
  type = object({
    name = string
    port = number
    path = string
  })
}

variable "client_proxy_port" {
  type = object({
    name = string
    port = number
  })
}

variable "logs_proxy_port" {
  type = object({
    name = string
    port = number
  })
}

variable "logs_health_proxy_port" {
  type = object({
    name        = string
    port        = number
    health_path = string
  })
}


variable "client_instance_group" {
  type = string
}

variable "server_instance_group" {
  type = string
}

variable "labels" {
  description = "The labels to attach to resources created by this module"
  type        = map(string)
}

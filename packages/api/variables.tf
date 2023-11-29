variable "prefix" {
  type = string
}

variable "gcp_project_id" {
  type = string
}
variable "gcp_region" {
  type = string
}
variable "gcp_zone" {
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
  })
}

variable "logs_proxy_address" {
  type = string
}

variable "environment" {
  type = string
}

variable "google_service_account_secret" {
  type = string
}

variable "docker_contexts_bucket_name" {
  type = string
}

variable "google_service_account_email" {
  type = string
}

variable "labels" {
  description = "The labels to attach to resources created by this module"
  type        = map(string)
  default     = {}
}

variable "gcp_project_id" {
  description = "The project to deploy the cluster in"
  type        = string
  default     = "e2b-prod"
}

variable "gcp_region" {
  type    = string
  default = "us-central1"
}

variable "gcp_zone" {
  description = "All GCP resources will be launched in this Zone."
  type        = string
  default     = "us-central1-a"
}

variable "server_cluster_size" {
  type    = number
  default = 1
}

variable "server_machine_type" {
  type    = string
  default = "n1-standard-1"
}

variable "client_cluster_size" {
  type    = number
  default = 1
}

variable "client_machine_type" {
  type    = string
  default = "n1-standard-1"
}

variable "client_proxy_health_port" {
  type = object({
    name = string
    port = number
    path = string
  })
  default = {
    name = "health"
    port = 3001
    path = "/health"
  }
}

variable "client_proxy_port" {
  type = object({
    name = string
    port = number
  })
  default = {
    name = "session"
    port = 3002
  }
}

variable "session_proxy_service_name" {
  type    = string
  default = "session-proxy"
}

variable "session_proxy_port" {
  type = object({
    name = string
    port = number
  })
  default = {
    name = "session"
    port = 3003
  }
}

variable "logs_proxy_port" {
  type = object({
    name = string
    port = number
  })
  default = {
    name = "logs"
    port = 30006
  }
}

variable "logs_health_proxy_port" {
  type = object({
    name        = string
    port        = number
    health_path = string
  })
  default = {
    name        = "logs-health"
    port        = 44313
    health_path = "/health"
  }
}

variable "api_port" {
  type = object({
    name        = string
    port        = number
    health_path = string
  })
  default = {
    name        = "api"
    port        = 50001
    health_path = "/health"
  }
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "github_organization" {
  type    = string
  default = "e2b-dev"
}

variable "github_repository" {
  type    = string
  default = "api"
}

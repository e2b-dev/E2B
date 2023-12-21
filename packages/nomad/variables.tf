variable "gcp_zone" {
  type = string
}

variable "consul_acl_token_secret_name" {
  type = string
}

variable "nomad_acl_token_secret_name" {
  type = string
}

# API
variable "api_docker_image_digest" {
  type = string
}

variable "api_port" {
  type = object({
    name        = string
    port        = number
    health_path = string
  })
}

variable "api_secret" {
  type = string
}

variable "logs_proxy_address" {
  type = string
}

variable "environment" {
  type = string
}

variable "docker_contexts_bucket_name" {
  type = string
}

variable "custom_envs_repository_name" {
  type = string
}

variable "gcp_project_id" {
  type = string
}
variable "gcp_region" {
  type = string
}

variable "google_service_account_key" {
  type = string
}

variable "posthog_api_key_secret_name" {
  type = string
}

variable "postgres_connection_string_secret_name" {
  type = string
}

# Proxies
variable "client_cluster_size" {
  type = number
}

variable "session_proxy_service_name" {
  type = string
}

variable "session_proxy_port" {
  type = object({
    name = string
    port = number
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

variable "domain_name" {
  type = string
}

# Telemetry
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

variable "grafana_api_key_secret_name" {
  type = string
}

variable "grafana_logs_username_secret_name" {
  type = string
}

variable "grafana_traces_username_secret_name" {
  type = string
}

variable "grafana_metrics_username_secret_name" {
  type = string
}

variable "grafana_logs_endpoint_secret_name" {
  type = string
}

variable "grafana_traces_endpoint_secret_name" {
  type = string
}

variable "grafana_metrics_endpoint_secret_name" {
  type = string
}

variable "analytics_collector_host_secret_name" {
  type = string
}

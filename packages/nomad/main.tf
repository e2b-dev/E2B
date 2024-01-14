data "google_secret_manager_secret_version" "nomad_acl_token" {
  secret = var.nomad_acl_token_secret_name
}

data "google_secret_manager_secret_version" "consul_acl_token" {
  secret = var.consul_acl_token_secret_name
}

# API
data "google_secret_manager_secret_version" "postgres_connection_string" {
  secret = var.postgres_connection_string_secret_name
}

data "google_secret_manager_secret_version" "posthog_api_key" {
  secret = var.posthog_api_key_secret_name
}

# Telemetry
data "google_secret_manager_secret_version" "grafana_api_key" {
  secret = var.grafana_api_key_secret_name
}

data "google_secret_manager_secret_version" "grafana_traces_endpoint" {
  secret = var.grafana_traces_endpoint_secret_name
}

data "google_secret_manager_secret_version" "grafana_logs_endpoint" {
  secret = var.grafana_logs_endpoint_secret_name
}

data "google_secret_manager_secret_version" "grafana_metrics_endpoint" {
  secret = var.grafana_metrics_endpoint_secret_name
}

data "google_secret_manager_secret_version" "grafana_traces_username" {
  secret = var.grafana_traces_username_secret_name
}

data "google_secret_manager_secret_version" "grafana_logs_username" {
  secret = var.grafana_logs_username_secret_name
}

data "google_secret_manager_secret_version" "grafana_metrics_username" {
  secret = var.grafana_metrics_username_secret_name
}

data "google_secret_manager_secret_version" "analytics_collector_host" {
  secret = var.analytics_collector_host_secret_name
}

data "google_secret_manager_secret_version" "analytics_collector_api_token" {
  secret = var.analytics_collector_api_token_secret_name
}

provider "nomad" {
  address   = "https://nomad.${var.domain_name}"
  secret_id = data.google_secret_manager_secret_version.nomad_acl_token.secret_data
}


provider "consul" {
  address = "https://consul.${var.domain_name}"
  token   = data.google_secret_manager_secret_version.consul_acl_token.secret_data
}


resource "consul_acl_policy" "agent" {
  name  = "agent"
  rules = <<-RULE
    key_prefix "" {
      policy = "deny"
    }
    RULE
}

resource "consul_acl_token_policy_attachment" "attachment" {
  token_id = "00000000-0000-0000-0000-000000000002"
  policy   = consul_acl_policy.agent.name
}

resource "nomad_job" "api" {
  jobspec = file("${path.module}/api.hcl")

  hcl2 {
    vars = {
      gcp_zone                      = var.gcp_zone
      api_port_name                 = var.api_port.name
      api_port_number               = var.api_port.port
      image_name                    = var.api_docker_image_digest
      postgres_connection_string    = data.google_secret_manager_secret_version.postgres_connection_string.secret_data
      posthog_api_key               = data.google_secret_manager_secret_version.posthog_api_key.secret_data
      logs_proxy_address            = var.logs_proxy_address
      nomad_address                 = "http://localhost:4646"
      nomad_token                   = data.google_secret_manager_secret_version.nomad_acl_token.secret_data
      consul_token                  = data.google_secret_manager_secret_version.consul_acl_token.secret_data
      environment                   = var.environment
      docker_contexts_bucket_name   = var.docker_contexts_bucket_name
      api_secret                    = var.api_secret
      google_service_account_secret = var.google_service_account_key
      gcp_project_id                = var.gcp_project_id
      gcp_region                    = var.gcp_region
      gcp_docker_repository_name    = var.custom_envs_repository_name
      analytics_collector_host      = data.google_secret_manager_secret_version.analytics_collector_host.secret_data
      analytics_collector_api_token = data.google_secret_manager_secret_version.analytics_collector_api_token.secret_data
    }
  }
}

resource "nomad_job" "client_proxy" {
  jobspec = file("${path.module}/client-proxy.hcl")

  hcl2 {
    vars = {
      gcp_zone                        = var.gcp_zone
      client_proxy_port_number        = var.client_proxy_port.port
      client_proxy_port_name          = var.client_proxy_port.name
      client_proxy_health_port_number = var.client_proxy_health_port.port
      client_proxy_health_port_name   = var.client_proxy_health_port.name
      client_proxy_health_port_path   = var.client_proxy_health_port.path
      session_proxy_service_name      = var.session_proxy_service_name
      domain_name                     = var.domain_name
    }
  }
}

resource "nomad_job" "session_proxy" {
  jobspec = file("${path.module}/session-proxy.hcl")

  hcl2 {
    vars = {
      gcp_zone                   = var.gcp_zone
      client_cluster_size        = var.client_cluster_size
      session_proxy_port_number  = var.session_proxy_port.port
      session_proxy_port_name    = var.session_proxy_port.name
      session_proxy_service_name = var.session_proxy_service_name
    }
  }
}

resource "nomad_job" "otel-collector" {
  jobspec = file("${path.module}/otel-collector.hcl")

  hcl2 {
    vars = {
      grafana_traces_endpoint  = data.google_secret_manager_secret_version.grafana_traces_endpoint.secret_data
      grafana_logs_endpoint    = data.google_secret_manager_secret_version.grafana_logs_endpoint.secret_data
      grafana_metrics_endpoint = data.google_secret_manager_secret_version.grafana_metrics_endpoint.secret_data

      grafana_traces_username  = data.google_secret_manager_secret_version.grafana_traces_username.secret_data
      grafana_logs_username    = data.google_secret_manager_secret_version.grafana_logs_username.secret_data
      grafana_metrics_username = data.google_secret_manager_secret_version.grafana_metrics_username.secret_data

      grafana_api_key = data.google_secret_manager_secret_version.grafana_api_key.secret_data

      gcp_zone = var.gcp_zone
    }
  }
}

resource "nomad_job" "logs-collector" {
  jobspec = file("${path.module}/logs-collector.hcl")

  hcl2 {
    vars = {
      gcp_zone = var.gcp_zone

      logs_port_number        = var.logs_proxy_port.port
      logs_health_port_number = var.logs_health_proxy_port.port
      logs_health_path        = var.logs_health_proxy_port.health_path
      logs_port_name          = var.logs_proxy_port.name

      grafana_api_key       = data.google_secret_manager_secret_version.grafana_api_key.secret_data
      grafana_logs_endpoint = data.google_secret_manager_secret_version.grafana_logs_endpoint.secret_data
      grafana_logs_username = data.google_secret_manager_secret_version.grafana_logs_username.secret_data
    }
  }
}

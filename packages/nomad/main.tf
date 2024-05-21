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
  address      = "https://nomad.${var.domain_name}"
  secret_id    = var.nomad_acl_token_secret
  consul_token = var.consul_acl_token_secret
}

provider "consul" {
  address = "https://consul.${var.domain_name}"
  token   = var.consul_acl_token_secret
}

resource "nomad_job" "api" {
  jobspec = file("${path.module}/api.hcl")

  hcl2 {
    vars = {
      orchestrator_address          = "http://localhost:${var.orchestrator_port}"
      template_manager_address      = "http://localhost:${var.template_manager_port}"
      loki_address                  = "http://localhost:${var.loki_service_port.port}"
      logs_collector_address        = "http://localhost:${var.logs_proxy_port.port}"
      gcp_zone                      = var.gcp_zone
      api_port_name                 = var.api_port.name
      api_port_number               = var.api_port.port
      image_name                    = var.api_docker_image_digest
      postgres_connection_string    = data.google_secret_manager_secret_version.postgres_connection_string.secret_data
      posthog_api_key               = data.google_secret_manager_secret_version.posthog_api_key.secret_data
      environment                   = var.environment
      analytics_collector_host      = data.google_secret_manager_secret_version.analytics_collector_host.secret_data
      analytics_collector_api_token = data.google_secret_manager_secret_version.analytics_collector_api_token.secret_data
      otel_tracing_print            = var.otel_tracing_print
    }
  }
}

resource "nomad_job" "docker_reverse_proxy" {
  jobspec = file("${path.module}/docker-reverse-proxy.hcl")

  hcl2 {
    vars = {
      gcp_zone                      = var.gcp_zone
      image_name                    = var.docker_reverse_proxy_image_digest
      postgres_connection_string    = data.google_secret_manager_secret_version.postgres_connection_string.secret_data
      google_service_account_secret = var.docker_reverse_proxy_service_account_key
      port_number                   = var.docker_reverse_proxy_port.port
      port_name                     = var.docker_reverse_proxy_port.name
      health_check_path             = var.docker_reverse_proxy_port.health_path
      domain_name                   = var.domain_name
      gcp_project_id                = var.gcp_project_id
      gcp_region                    = var.gcp_region
      docker_registry               = var.custom_envs_repository_name
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

      consul_token = var.consul_acl_token_secret

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

      loki_service_port_number = var.loki_service_port.port

      grafana_api_key       = data.google_secret_manager_secret_version.grafana_api_key.secret_data
      grafana_logs_endpoint = data.google_secret_manager_secret_version.grafana_logs_endpoint.secret_data
      grafana_logs_username = data.google_secret_manager_secret_version.grafana_logs_username.secret_data
    }
  }
}

data "google_storage_bucket_object" "orchestrator" {
  name   = "orchestrator"
  bucket = var.fc_env_pipeline_bucket_name
}


data "external" "orchestrator_checksum" {
  program = ["bash", "${path.module}/checksum.sh"]

  query = {
    base64 = data.google_storage_bucket_object.orchestrator.md5hash
  }
}

data "google_compute_machine_types" "client" {
  zone   = var.gcp_zone
  filter = "name = \"${var.client_machine_type}\""
}

resource "nomad_job" "orchestrator" {
  jobspec = file("${path.module}/orchestrator.hcl")

  hcl2 {
    vars = {
      gcp_zone     = var.gcp_zone
      port         = var.orchestrator_port
      environment  = var.environment
      consul_token = var.consul_acl_token_secret
      cpu_mhz      = floor(data.google_compute_machine_types.client.machine_types[0].guest_cpus * 1.5) * 1000
      memory_mb    = floor(data.google_compute_machine_types.client.machine_types[0].memory_mb * 0.8 / 1024) * 1024

      bucket_name           = var.fc_env_pipeline_bucket_name
      orchestrator_checksum = data.external.orchestrator_checksum.result.hex
      logs_proxy_address    = var.logs_proxy_address
      otel_tracing_print    = var.otel_tracing_print
    }
  }
}

data "google_storage_bucket_object" "template_manager" {
  name   = "template-manager"
  bucket = var.fc_env_pipeline_bucket_name
}


data "external" "template_manager" {
  program = ["bash", "${path.module}/checksum.sh"]

  query = {
    base64 = data.google_storage_bucket_object.template_manager.md5hash
  }
}

resource "nomad_job" "template_manager" {
  jobspec = file("${path.module}/template-manager.hcl")

  hcl2 {
    vars = {
      gcp_project = var.gcp_project_id
      gcp_region  = var.gcp_region
      gcp_zone    = var.gcp_zone
      port        = var.template_manager_port
      environment = var.environment

      api_secret                 = var.api_secret
      bucket_name                = var.fc_env_pipeline_bucket_name
      docker_registry            = var.custom_envs_repository_name
      google_service_account_key = var.google_service_account_key
      template_manager_checksum  = data.external.template_manager.result.hex
      otel_tracing_print         = var.otel_tracing_print
    }
  }
}

resource "nomad_job" "loki" {
  jobspec = file("${path.module}/loki.hcl")

  hcl2 {
    vars = {
      gcp_zone = var.gcp_zone

      loki_bucket_name = var.loki_bucket_name

      loki_service_port_number = var.loki_service_port.port
      loki_service_port_name   = var.loki_service_port.name
    }
  }
}

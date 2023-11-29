terraform {
  required_providers {
    nomad = {
      source  = "hashicorp/nomad"
      version = "2.0.0"
    }
  }
}

resource "nomad_job" "otel-collector" {
  jobspec = file("${path.module}/otel-collector.hcl")

  hcl2 {
    vars = {
      grafana_traces_endpoint  = var.grafana_traces_endpoint
      grafana_logs_endpoint    = var.grafana_logs_endpoint
      grafana_metrics_endpoint = var.grafana_metrics_endpoint

      grafana_traces_username  = var.grafana_traces_username
      grafana_logs_username    = var.grafana_logs_username
      grafana_metrics_username = var.grafana_metrics_username

      grafana_api_key = var.grafana_api_key

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

      grafana_api_key       = var.grafana_api_key
      grafana_logs_endpoint = var.grafana_logs_endpoint
      grafana_logs_username = var.grafana_logs_username
    }
  }
}

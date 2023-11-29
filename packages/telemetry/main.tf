terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "5.6.0"
    }
    nomad = {
      source  = "hashicorp/nomad"
      version = "2.0.0"
    }
  }
}

resource "google_secret_manager_secret" "grafana_api_key" {
  secret_id = "${var.prefix}grafana-api-key"

  replication {
    auto {}
  }
}

data "google_secret_manager_secret_version" "grafana_api_key" {
  secret = google_secret_manager_secret.grafana_api_key.name
}


resource "google_secret_manager_secret" "grafana_traces_endpoint" {
  secret_id = "${var.prefix}grafana-traces-endpoint"

  replication {
    auto {}
  }
}

data "google_secret_manager_secret_version" "grafana_traces_endpoint" {
  secret = google_secret_manager_secret.grafana_traces_endpoint.name
}

resource "google_secret_manager_secret" "grafana_logs_endpoint" {
  secret_id = "${var.prefix}grafana-logs-endpoint"

  replication {
    auto {}
  }
}

data "google_secret_manager_secret_version" "grafana_logs_endpoint" {
  secret = google_secret_manager_secret.grafana_logs_endpoint.name
}

resource "google_secret_manager_secret" "grafana_metrics_endpoint" {
  secret_id = "${var.prefix}grafana-metrics-endpoint"

  replication {
    auto {}
  }
}

data "google_secret_manager_secret_version" "grafana_metrics_endpoint" {
  secret = google_secret_manager_secret.grafana_metrics_endpoint.name
}

resource "google_secret_manager_secret" "grafana_traces_username" {
  secret_id = "${var.prefix}grafana-traces-username"

  replication {
    auto {}
  }
}

data "google_secret_manager_secret_version" "grafana_traces_username" {
  secret = google_secret_manager_secret.grafana_traces_username.name
}

resource "google_secret_manager_secret" "grafana_logs_username" {
  secret_id = "${var.prefix}grafana-logs-username"

  replication {
    auto {}
  }
}

data "google_secret_manager_secret_version" "grafana_logs_username" {
  secret = google_secret_manager_secret.grafana_logs_username.name
}

resource "google_secret_manager_secret" "grafana_metrics_username" {
  secret_id = "${var.prefix}grafana-metrics-username"

  replication {
    auto {}
  }
}

data "google_secret_manager_secret_version" "grafana_metrics_username" {
  secret = google_secret_manager_secret.grafana_metrics_username.name
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

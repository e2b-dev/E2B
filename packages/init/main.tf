resource "google_service_account" "infra_instances_service_account" {
  account_id   = "${var.prefix}infra-instances"
  display_name = "Infra Instances Service Account"
}


resource "google_secret_manager_secret" "cloudflare_api_token" {
  secret_id = "${var.prefix}cloudflare-api-token"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "consul_acl_token" {
  secret_id = "${var.prefix}consul-secret-id"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "nomad_acl_token" {
  secret_id = "${var.prefix}nomad-secret-id"

  replication {
    auto {}
  }
}


resource "google_secret_manager_secret" "grafana_api_key" {
  secret_id = "${var.prefix}grafana-api-key"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "grafana_traces_endpoint" {
  secret_id = "${var.prefix}grafana-traces-endpoint"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "grafana_logs_endpoint" {
  secret_id = "${var.prefix}grafana-logs-endpoint"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "grafana_metrics_endpoint" {
  secret_id = "${var.prefix}grafana-metrics-endpoint"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "grafana_traces_username" {
  secret_id = "${var.prefix}grafana-traces-username"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "grafana_logs_username" {
  secret_id = "${var.prefix}grafana-logs-username"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "grafana_metrics_username" {
  secret_id = "${var.prefix}grafana-metrics-username"

  replication {
    auto {}
  }
}


resource "google_artifact_registry_repository" "orchestration_repository" {
  format        = "DOCKER"
  repository_id = "e2b-orchestration"
  labels        = var.labels
}

resource "google_artifact_registry_repository_iam_member" "orchestration_repository_member" {
  repository = google_artifact_registry_repository.orchestration_repository.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.infra_instances_service_account.email}"
}

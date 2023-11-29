terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
    google = {
      source  = "hashicorp/google"
      version = "5.6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.5.1"
    }
    nomad = {
      source  = "hashicorp/nomad"
      version = "2.0.0"
    }
  }
}


resource "google_artifact_registry_repository" "custom_environments_repository" {
  format        = "DOCKER"
  repository_id = "${var.prefix}custom-environments"
  labels        = var.labels
}

resource "google_artifact_registry_repository_iam_member" "custom_environments_repository_member" {
  repository = google_artifact_registry_repository.custom_environments_repository.name
  role       = "roles/artifactregistry.repoAdmin"
  member     = "serviceAccount:${var.google_service_account_email}"
}

resource "google_artifact_registry_repository" "orchestration_repository" {
  format        = "DOCKER"
  repository_id = "e2b-orchestration"
  labels        = var.labels
}

resource "google_artifact_registry_repository_iam_member" "orchestration_repository_member" {
  repository = google_artifact_registry_repository.orchestration_repository.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${var.google_service_account_email}"
}

resource "docker_image" "docker_image_api" {
  name = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.orchestration_repository.name}/api"
  build {
    context    = "."
    dockerfile = "api.Dockerfile"

  }
  platform = "linux/amd64/v4"
}

data "docker_registry_image" "api_image" {
  name = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.orchestration_repository.name}/api"
}

resource "docker_image" "api_image" {
  name          = data.docker_registry_image.api_image.name
  pull_triggers = [data.docker_registry_image.api_image.sha256_digest]
}

resource "google_secret_manager_secret" "postgres_connection_string" {
  secret_id = "${var.prefix}postgres-connection-string"

  replication {
    auto {}
  }
}

data "google_secret_manager_secret_version" "postgres_connection_string" {
  secret = google_secret_manager_secret.postgres_connection_string.name
}

resource "google_secret_manager_secret" "posthog_api_key" {
  secret_id = "${var.prefix}posthog-api-key"

  replication {
    auto {}
  }
}

data "google_secret_manager_secret_version" "posthog_api_key" {
  secret = google_secret_manager_secret.posthog_api_key.name
}

resource "random_password" "api_secret" {
  length  = 32
  special = false
}

resource "google_secret_manager_secret" "api_secret" {
  secret_id = "${var.prefix}api-secret"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "api_secret_value" {
  secret = google_secret_manager_secret.api_secret.id

  secret_data = random_password.api_secret.result
}

resource "nomad_job" "api" {
  jobspec = file("${path.module}/api.hcl")

  hcl2 {
    vars = {
      gcp_zone                      = var.gcp_zone
      api_port_name                 = var.api_port.name
      api_port_number               = var.api_port.port
      image_name                    = docker_image.api_image.repo_digest
      postgres_connection_string    = data.google_secret_manager_secret_version.postgres_connection_string.secret_data
      posthog_api_key               = data.google_secret_manager_secret_version.posthog_api_key.secret_data
      logs_proxy_address            = var.logs_proxy_address
      nomad_address                 = "http://localhost:4646"
      nomad_token                   = var.nomad_token
      consul_token                  = var.consul_token
      environment                   = var.environment
      docker_contexts_bucket_name   = var.docker_contexts_bucket_name
      api_secret                    = random_password.api_secret.result
      google_service_account_secret = var.google_service_account_secret
      gcp_project_id                = var.gcp_project_id
      gcp_region                    = var.gcp_region
      gcp_docker_repository_name    = google_artifact_registry_repository.custom_environments_repository.name
    }
  }
}

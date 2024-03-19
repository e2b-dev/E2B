terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

data "docker_registry_image" "docker_reverse_proxy_image" {
  name = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${var.orchestration_repository_name}/docker-reverse-proxy"
}

resource "docker_image" "docker_reverse_proxy_image" {
  name          = data.docker_registry_image.docker_reverse_proxy_image.name
  pull_triggers = [data.docker_registry_image.docker_reverse_proxy_image.sha256_digest]
}

resource "google_service_account" "docker_registry_service_account" {
  account_id   = "${var.prefix}docker-reverse-proxy-sa"
  display_name = "Docker Reverse Proxy Service Account"
}

resource "google_artifact_registry_repository_iam_member" "orchestration_repository_member" {
  repository = var.custom_envs_repository_name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.docker_registry_service_account.email}"
}

resource "google_service_account_key" "google_service_key" {
  service_account_id = google_service_account.docker_registry_service_account.id
}

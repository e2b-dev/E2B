terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

data "docker_registry_image" "docker_reverse_proxy_image" {
  name = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/e2b-orchestration/docker-reverse-proxy"
}

resource "docker_image" "docker_reverse_proxy_image" {
  name          = data.docker_registry_image.docker_reverse_proxy_image.name
  pull_triggers = [data.docker_registry_image.docker_reverse_proxy_image.sha256_digest]
}

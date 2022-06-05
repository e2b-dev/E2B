terraform {
  required_version = ">= 1.1.9"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "2.16.0"
    }
  }
}

data "docker_image" "latest" {
  name = var.image_name
}

data "google_secret_manager_secret_version" "supabase_key" {
  secret = "supabase-key"
}

data "google_secret_manager_secret_version" "supabase_url" {
  secret = "supabase-url"
}

data "google_secret_manager_secret_version" "api_admin_key" {
  secret = "api-admin-key"
}

resource "nomad_job" "api" {
  jobspec = file("${path.module}/api.hcl")

  hcl2 {
    enabled = true
    vars = {
      supabase_key    = data.google_secret_manager_secret_version.supabase_key.secret_data
      supabase_url    = data.google_secret_manager_secret_version.supabase_url.secret_data
      api_admin_key   = data.google_secret_manager_secret_version.api_admin_key.secret_data
      gcp_zone        = var.gcp_zone
      api_port_number = var.api_port.port
      api_port_name   = var.api_port.name
      nomad_address   = var.nomad_address
      image_name      = data.docker_image.latest.repo_digest
    }
  }
}

terraform {
  required_version = "1.1.9"
  backend "gcs" {
    bucket = "devbook-terraform-state"
    prefix = "terraform/orchestration/state"
  }
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "2.16.0"
    }
  }
}

provider "docker" {}

provider "google-beta" {
  project = var.gcp_project_id
  region  = var.gcp_region
  zone    = var.gcp_zone
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
  zone    = var.gcp_zone
}

module "cluster" {
  source = "./cluster"

  gcp_project_id = var.gcp_project_id

  server_cluster_size = var.server_cluster_size
  client_cluster_size = var.client_cluster_size

  server_machine_type = var.server_machine_type
  client_machine_type = var.client_machine_type

  session_proxy_service_name = var.session_proxy_service_name

  logs_health_proxy_port = var.logs_health_proxy_port
  logs_proxy_port        = var.logs_proxy_port

  session_proxy_port       = var.session_proxy_port
  client_proxy_health_port = var.client_proxy_health_port
  client_proxy_port        = var.client_proxy_port
  api_port                 = var.api_port
}

data "google_compute_global_address" "orch_server_ip" {
  name = "orch-server-ip"
}

provider "nomad" {
  address = "http://${data.google_compute_global_address.orch_server_ip.address}"
}

data "google_secret_manager_secret_version" "lightstep_api_key" {
  secret = "lightstep-api-key"
}

data "google_secret_manager_secret_version" "logtail_api_key" {
  secret = "logtail-api-key"
}

module "telemetry" {
  source = "./telemetry"

  logs_health_proxy_port = var.logs_health_proxy_port
  logs_proxy_port        = var.logs_proxy_port
  lightstep_api_key      = data.google_secret_manager_secret_version.lightstep_api_key.secret_data
  logtail_api_key        = data.google_secret_manager_secret_version.logtail_api_key.secret_data
  gcp_zone               = var.gcp_zone
}

module "session_proxy" {
  source = "./session-proxy"

  client_cluster_size        = var.client_cluster_size
  gcp_zone                   = var.gcp_zone
  session_proxy_service_name = var.session_proxy_service_name

  session_proxy_port = var.session_proxy_port
}

module "client_proxy" {
  source = "./client-proxy"

  gcp_zone                   = var.gcp_zone
  session_proxy_service_name = var.session_proxy_service_name

  client_proxy_port        = var.client_proxy_port
  client_proxy_health_port = var.client_proxy_health_port
}

module "api" {
  source = "./api"

  gcp_zone = var.gcp_zone

  logs_proxy_address = "http://${module.cluster.logs_proxy_ip}"
  nomad_address      = "http://${module.cluster.server_proxy_ip}"
  api_port           = var.api_port
}

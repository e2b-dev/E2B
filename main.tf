terraform {
  required_version = ">= 1.1.9"
  backend "gcs" {
    bucket = "devbook-terraform-state"
    prefix = "terraform/orchestration/state"
  }
}

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

module "server_cluster" {
  source = "./modules/orchestrator/server-cluster"
}

module "client_cluster" {
  source = "./modules/orchestrator/client-cluster"
}

provider "nomad" {
  address = module.server_cluster.nomad_address
}

module "api" {
  source = "./modules/api"

  nomad_address = module.server_cluster.nomad_address
}

module "firecracker_sessions" {
  source = "./modules/firecracker-sessions"
}

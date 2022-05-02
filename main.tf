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

module "orchestrator" {
  source = "./modules/orchestrator"
}

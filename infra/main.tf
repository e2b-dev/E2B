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

# module "fc_envs_disk" {
#   source = "./modules/fc-envs-disk"
# }

module "server_cluster" {
  source = "./modules/server-cluster"
}

# module "client_cluster" {
#   source = "./modules/client-cluster"

#   fc_envs_disk_name = module.fc_envs_disk.fc_envs_disk_name
# }

provider "nomad" {
  address = module.server_cluster.nomad_address
}

module "orchestration_api" {
  source = "./modules/orchestration-api"

  nomad_address = module.server_cluster.nomad_address
}

# module "firecracker_session" {
#   source = "./modules/firecracker-session"
# }

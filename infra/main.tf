terraform {
  required_version = ">= 1.1.9"

  backend "gcs" {
    bucket = "devbook-terraform-state"
    prefix = "terraform/orchestration/state"
  }
}

module "fc_init_disk" {
  source = "./modules/fc-init-disk"
}

module "server_cluster" {
  source = "./modules/server-cluster"
}

module "client_cluster" {
  source = "./modules/client-cluster"
  depends_on = [
    modules.fc_init_disk
  ]
}

# module "orchestration_api" {
#   source = "./modules/orchestration-api"
#   depends_on = [
#     module.client_cluster,
#     module.server_cluster,
#   ]
# }

# module "firecracker_session" {
#   source = "./modules/firecracker-session"
#   depends_on = [
#     module.client_cluster,
#     module.server_cluster,
#   ]
# }

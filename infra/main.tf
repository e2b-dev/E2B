module "server_cluster" {
  source = "./modules/server-cluster"
}

module "client_cluster" {
  source = "./modules/client-cluster"
}

module "orchestration_api" {
  source = "./modules/orchestration-api"
}

module "firecracker_sessions" {
  source = "./modules/firecracker-sessions"
}

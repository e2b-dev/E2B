# Server cluster instances are not currently automatically updated when you create a new
# orchestrator image with Packer.
module "server_cluster" {
  source = "./server-cluster"

  startup_script                             = data.template_file.startup_script_server.rendered
  instance_group_update_policy_min_ready_sec = 0

  cluster_name     = var.server_cluster_name
  cluster_size     = var.server_cluster_size
  cluster_tag_name = var.cluster_tag_name

  machine_type = var.server_machine_type
  image_family = var.server_image_family

  gcp_project_id = var.gcp_project_id
  network_name   = var.network_name
}

module "client_cluster" {
  source = "./client-cluster"

  startup_script                             = data.template_file.startup_script_client.rendered
  instance_group_update_policy_min_ready_sec = 0

  cluster_name     = var.client_cluster_name
  cluster_size     = var.client_cluster_size
  cluster_tag_name = var.cluster_tag_name

  machine_type = var.client_machine_type
  image_family = var.client_image_family

  network_name = var.network_name
}

data "template_file" "startup_script_server" {
  template = file("${path.module}/scripts/start-server.sh")

  vars = {
    num_servers      = var.server_cluster_size
    cluster_tag_name = var.cluster_tag_name
  }
}

data "template_file" "startup_script_client" {
  template = file("${path.module}/scripts/start-client.sh")

  vars = {
    cluster_tag_name = var.cluster_tag_name
  }
}

resource "google_compute_firewall" "orchstrator_firewall_ingress" {
  name    = "${var.cluster_tag_name}-firewall-ingress"
  network = var.network_name
  allow {
    protocol = "all"
  }
  direction   = "INGRESS"
  source_tags = [var.cluster_tag_name]
  target_tags = [var.cluster_tag_name]
}

resource "google_compute_firewall" "orchstrator_firewall_egress" {
  name    = "${var.cluster_tag_name}-firewall-egress"
  network = var.network_name
  allow {
    protocol = "all"
  }
  direction   = "EGRESS"
  target_tags = [var.cluster_tag_name]
}

provider "nomad" {
  address = "http://${module.server_cluster.server_proxy_ip}"
}

module "firecracker-sessions" {
  source = "./firecracker-sessions"

  depends_on = [
    module.server_cluster
  ]

  gcp_zone = var.gcp_zone
}

module "firecracker-envs" {
  source = "./firecracker-envs"

  depends_on = [
    module.server_cluster
  ]

  gcp_zone = var.gcp_zone
  out_dir = var.firecracker_envs.mnt_dir_path
  out_files_basenames = {
    rootfs  = var.firecracker_envs.rootfs
    snap    = var.firecracker_envs.snap
  }
}

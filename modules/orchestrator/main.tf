module "server_cluster" {
  source = "./server-cluster"

  startup_script                             = data.template_file.startup_script_server.rendered
  instance_group_update_policy_min_ready_sec = 0

  cluster_name     = var.server_cluster_name
  cluster_size     = var.server_cluster_size
  cluster_tag_name = var.cluster_tag_name

  machine_type = var.server_machine_type
  image_family = var.server_image_family

  network_name = var.network_name
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

resource "google_compute_firewall" "orchstrator_firewall" {
  name    = "${var.cluster_tag_name}-firewall"
  network = var.network_name
  allow {
    protocol = "all"
  }
  source_tags = [var.cluster_tag_name]
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

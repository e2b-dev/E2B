data "template_file" "startup_script_server" {
  template = file("${path.module}/scripts/start-server.sh")

  vars = {
    num_servers      = var.server_cluster_size
    cluster_tag_name = var.cluster_tag_name
  }
}

# Server cluster instances are not currently automatically updated when you create a new
# orchestrator image with Packer.
module "server_cluster" {
  source = "./server"

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

data "template_file" "startup_script_client" {
  template = file("${path.module}/scripts/start-client.sh")

  vars = {
    cluster_tag_name = var.cluster_tag_name
  }
}

module "client_cluster" {
  source = "./client"

  startup_script                             = data.template_file.startup_script_client.rendered
  instance_group_update_policy_min_ready_sec = 0

  cluster_name     = var.client_cluster_name
  cluster_size     = var.client_cluster_size
  cluster_tag_name = var.cluster_tag_name

  machine_type = var.client_machine_type
  image_family = var.client_image_family

  gcp_project_id = var.gcp_project_id
  network_name   = var.network_name

  client_proxy_port        = var.client_proxy_port
  client_proxy_health_port = var.client_proxy_health_port

  api_port = var.api_port
}

resource "google_compute_firewall" "orchstrator_firewall_ingress" {
  name    = "${var.cluster_tag_name}-firewall-ingress"
  network = var.network_name
  allow {
    protocol = "all"
  }
  direction = "INGRESS"
  # source_tags = [var.cluster_tag_name]
  target_tags   = [var.cluster_tag_name]
  source_ranges = ["130.211.0.0/22", "35.191.0.0/16", "94.113.136.120"]
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

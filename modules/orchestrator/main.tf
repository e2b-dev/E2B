module "server_cluster" {
  source = "./server-cluster"

  startup_script                             = data.template_file.startup_script_server.rendered
  shutdown_script                            = data.template_file.shutdown_script.rendered
  instance_group_update_policy_min_ready_sec = 10

  cluster_name     = var.server_cluster_name
  cluster_size     = var.server_cluster_size
  cluster_tag_name = var.cluster_tag_name

  machine_type = var.server_machine_type
}

module "client_cluster" {
  source = "./client-cluster"

  startup_script                             = data.template_file.startup_script_client.rendered
  shutdown_script                            = data.template_file.shutdown_script.rendered
  instance_group_update_policy_min_ready_sec = 10

  cluster_name     = var.client_cluster_name
  cluster_size     = var.client_cluster_size
  cluster_tag_name = var.cluster_tag_name

  machine_type = var.client_machine_type
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

data "template_file" "shutdown_script" {
  template = file("${path.module}/scripts/shutdown.sh")
}

resource "google_compute_firewall" "orchstrator_firewall" {
  name    = "${var.cluster_tag_name}-firewall"
  network = "default"
  allow {
    protocol = "all"
  }
  source_tags = [var.cluster_tag_name]
  target_tags = [var.cluster_tag_name]
}

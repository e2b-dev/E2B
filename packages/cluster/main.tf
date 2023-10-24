# Server cluster instances are not currently automatically updated when you create a new
# orchestrator image with Packer.


resource "google_storage_bucket_iam_member" "envs-docker-context-iam" {
  bucket = "e2b-envs-docker-context"
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${var.google_service_account_email}"
}

resource "google_storage_bucket_iam_member" "envs-pipeline-iam" {
  bucket = "e2b-fc-env-pipeline"
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${var.google_service_account_email}"
}

resource "google_project_iam_member" "service-account-roles" {
  project = var.gcp_project_id
  role    = "roles/editor"
  member  = "serviceAccount:${var.google_service_account_email}"
}

module "server_cluster" {
  source = "./server"

  startup_script = templatefile("${path.module}/scripts/start-server.sh", {
    num_servers      = var.server_cluster_size
    cluster_tag_name = var.cluster_tag_name
  })
  instance_group_update_policy_min_ready_sec = 0

  cluster_name     = var.server_cluster_name
  cluster_size     = var.server_cluster_size
  cluster_tag_name = var.cluster_tag_name

  machine_type = var.server_machine_type
  image_family = var.server_image_family

  gcp_project_id = var.gcp_project_id
  network_name   = var.network_name

  service_account_email = var.google_service_account_email
}

module "client_cluster" {
  source = "./client"

  startup_script = templatefile("${path.module}/scripts/start-client.sh", {
    cluster_tag_name = var.cluster_tag_name
  })
  instance_group_update_policy_min_ready_sec = 0

  cluster_name     = var.client_cluster_name
  cluster_size     = var.client_cluster_size
  cluster_tag_name = var.cluster_tag_name

  machine_type = var.client_machine_type
  image_family = var.client_image_family

  gcp_project_id = var.gcp_project_id
  network_name   = var.network_name

  logs_health_proxy_port = var.logs_health_proxy_port
  logs_proxy_port        = var.logs_proxy_port

  client_proxy_port        = var.client_proxy_port
  client_proxy_health_port = var.client_proxy_health_port

  api_port = var.api_port

  service_account_email = var.google_service_account_email
}

resource "google_compute_firewall" "orchstrator_firewall_ingress" {
  name    = "${var.cluster_tag_name}-firewall-ingress"
  network = var.network_name

  allow {
    protocol = "tcp"
    ports    = ["80", "8080", "4646", "3001", "3002", "3003", "30006", "44313", "50001", "8500"]
  }

  direction     = "INGRESS"
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

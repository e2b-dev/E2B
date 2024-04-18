# Server cluster instances are not currently automatically updated when you create a new
# orchestrator image with Packer.
locals {
  file_hash = {
    "scripts/run-consul.sh" = substr(filesha256("${path.module}/scripts/run-consul.sh"), 0, 5)
    "scripts/run-nomad.sh"  = substr(filesha256("${path.module}/scripts/run-nomad.sh"), 0, 5)
  }
}

resource "google_secret_manager_secret" "consul_gossip_encryption_key" {
  secret_id = "${var.prefix}consul-gossip-key"

  replication {
    auto {}
  }
}

resource "random_id" "consul_gossip_encryption_key" {
  byte_length = 32
}

resource "google_secret_manager_secret_version" "consul_gossip_encryption_key" {
  secret      = google_secret_manager_secret.consul_gossip_encryption_key.name
  secret_data = random_id.consul_gossip_encryption_key.b64_std
}

resource "google_project_iam_member" "network_viewer" {
  project = var.gcp_project_id
  member  = "serviceAccount:${var.google_service_account_email}"
  role    = "roles/compute.networkViewer"
}

resource "google_project_iam_member" "monitoring_editor" {
  project = var.gcp_project_id
  member  = "serviceAccount:${var.google_service_account_email}"
  role    = "roles/monitoring.editor"
}
resource "google_project_iam_member" "logging_writer" {
  project = var.gcp_project_id
  member  = "serviceAccount:${var.google_service_account_email}"
  role    = "roles/logging.logWriter"
}

variable "setup_files" {
  type = map(string)
  default = {
    "scripts/run-nomad.sh"  = "run-nomad",
    "scripts/run-consul.sh" = "run-consul"
  }
}

resource "google_storage_bucket_object" "setup_config_objects" {
  for_each = var.setup_files
  name     = "${each.value}-${local.file_hash[each.key]}.sh"
  source   = "${path.module}/${each.key}"
  bucket   = var.cluster_setup_bucket_name
}

module "server_cluster" {
  source = "./server"

  startup_script = templatefile("${path.module}/scripts/start-server.sh", {
    NUM_SERVERS                  = var.server_cluster_size
    CLUSTER_TAG_NAME             = var.cluster_tag_name
    SCRIPTS_BUCKET               = var.cluster_setup_bucket_name
    NOMAD_TOKEN                  = var.nomad_acl_token_secret
    CONSUL_TOKEN                 = var.consul_acl_token_secret
    RUN_CONSUL_FILE_HASH         = local.file_hash["scripts/run-consul.sh"]
    RUN_NOMAD_FILE_HASH          = local.file_hash["scripts/run-nomad.sh"]
    CONSUL_GOSSIP_ENCRYPTION_KEY = google_secret_manager_secret_version.consul_gossip_encryption_key.secret_data
  })

  cluster_name     = "${var.prefix}${var.server_cluster_name}"
  cluster_size     = var.server_cluster_size
  cluster_tag_name = var.cluster_tag_name
  gcp_zone = var.gcp_zone

  machine_type = var.server_machine_type
  image_family = var.server_image_family

  network_name          = var.network_name
  service_account_email = var.google_service_account_email

  nomad_port = var.nomad_port

  labels = var.labels

  depends_on = [google_storage_bucket_object.setup_config_objects]
}

module "client_cluster" {
  source = "./client"

  startup_script = templatefile("${path.module}/scripts/start-client.sh", {
    CLUSTER_TAG_NAME             = var.cluster_tag_name
    SCRIPTS_BUCKET               = var.cluster_setup_bucket_name
    FC_KERNELS_BUCKET_NAME       = var.fc_kernels_bucket_name
    FC_VERSIONS_BUCKET_NAME      = var.fc_versions_bucket_name
    FC_ENV_PIPELINE_BUCKET_NAME  = var.fc_env_pipeline_bucket_name
    DOCKER_CONTEXTS_BUCKET_NAME  = var.docker_contexts_bucket_name
    DISK_DEVICE_NAME             = var.fc_envs_disk_device_name
    GCP_REGION                   = var.gcp_region
    GOOGLE_SERVICE_ACCOUNT_KEY   = var.google_service_account_key
    NOMAD_TOKEN                  = var.nomad_acl_token_secret
    CONSUL_TOKEN                 = var.consul_acl_token_secret
    RUN_CONSUL_FILE_HASH         = local.file_hash["scripts/run-consul.sh"]
    RUN_NOMAD_FILE_HASH          = local.file_hash["scripts/run-nomad.sh"]
    CONSUL_GOSSIP_ENCRYPTION_KEY = google_secret_manager_secret_version.consul_gossip_encryption_key.secret_data
  })

  cluster_name     = "${var.prefix}${var.client_cluster_name}"
  cluster_size     = var.client_cluster_size
  cluster_tag_name = var.cluster_tag_name
  gcp_zone = var.gcp_zone

  machine_type = var.client_machine_type
  image_family = var.client_image_family

  network_name = var.network_name

  logs_health_proxy_port = var.logs_health_proxy_port
  logs_proxy_port        = var.logs_proxy_port

  client_proxy_port        = var.client_proxy_port
  client_proxy_health_port = var.client_proxy_health_port

  api_port                  = var.api_port
  docker_reverse_proxy_port = var.docker_reverse_proxy_port
  nomad_port                = var.nomad_port

  service_account_email = var.google_service_account_email

  fc_envs_disk_name        = var.fc_envs_disk_name
  fc_envs_disk_device_name = var.fc_envs_disk_device_name

  labels     = var.labels
  depends_on = [google_storage_bucket_object.setup_config_objects]
}

module "network" {
  source = "./network"

  gcp_project_id = var.gcp_project_id

  api_port                  = var.api_port
  docker_reverse_proxy_port = var.docker_reverse_proxy_port
  network_name              = var.network_name
  domain_name               = var.domain_name

  client_instance_group    = module.client_cluster.instance_group
  client_proxy_port        = var.client_proxy_port
  client_proxy_health_port = var.client_proxy_health_port

  server_instance_group = module.server_cluster.instance_group

  nomad_port             = var.nomad_port
  logs_proxy_port        = var.logs_proxy_port
  logs_health_proxy_port = var.logs_health_proxy_port

  cluster_tag_name = var.cluster_tag_name

  labels = var.labels
  prefix = var.prefix
}

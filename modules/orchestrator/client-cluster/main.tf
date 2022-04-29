resource "google_compute_instance_group_manager" "client_cluster" {
  name = "${var.cluster_name}-ig"

  version {
    instance_template = google_compute_instance_template.client.id
  }

  provider = google-beta

  # Server is a stateful cluster, so the update strategy used to roll out a new GCE Instance Template must be
  # a rolling update.
  update_policy {
    type                    = var.instance_group_update_policy_type
    minimal_action          = var.instance_group_update_policy_minimal_action
    max_surge_fixed         = var.instance_group_update_policy_max_surge_fixed
    max_surge_percent       = var.instance_group_update_policy_max_surge_percent
    max_unavailable_fixed   = var.instance_group_update_policy_max_unavailable_fixed
    max_unavailable_percent = var.instance_group_update_policy_max_unavailable_percent
  }

  base_instance_name = var.cluster_name
  target_size        = var.cluster_size
  target_pools       = var.instance_group_target_pools

  depends_on = [
    google_compute_instance_template.client,
  ]
}

data "google_compute_image" "source_image" {
  family = "orch"
}

resource "google_compute_instance_template" "client" {
  name_prefix = "${var.cluster_name}-"

  instance_description = var.cluster_description
  machine_type         = var.machine_type
  min_cpu_platform     = "Intel Haswell"

  tags                    = concat([var.cluster_tag_name], var.custom_tags)
  metadata_startup_script = var.startup_script
  metadata = merge(
    {
      "${var.metadata_key_name_for_cluster_size}" = var.cluster_size

      # The Terraform Google provider currently doesn't support a `metadata_shutdown_script` argument so we manually
      # set it here using the instance metadata.
      "shutdown-script" = var.shutdown_script
    },
    var.custom_metadata,
  )

  scheduling {
    on_host_maintenance = "MIGRATE"
  }

  disk {
    boot         = true
    source_image = data.google_compute_image.source_image.id
    disk_size_gb = var.root_volume_disk_size_gb
  }

  network_interface {
    network = var.network_name
  }

  # For a full list of oAuth 2.0 Scopes, see https://developers.google.com/identity/protocols/googlescopes
  service_account {
    scopes = [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/compute.readonly",
    ]
  }

  # Per Terraform Docs (https://www.terraform.io/docs/providers/google/r/compute_instance_template.html#using-with-instance-group-manager),
  # we need to create a new instance template before we can destroy the old one. Note that any Terraform resource on
  # which this Terraform resource depends will also need this lifecycle statement.
  lifecycle {
    create_before_destroy = true
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# CREATE FIREWALL RULES
# ---------------------------------------------------------------------------------------------------------------------

module "firewall_rules" {
  source = "./client-firewall-rules"

  cluster_name     = var.cluster_name
  cluster_tag_name = var.cluster_tag_name

  allowed_inbound_cidr_blocks_http = var.allowed_inbound_cidr_blocks_http
  allowed_inbound_cidr_blocks_rpc  = var.allowed_inbound_cidr_blocks_rpc
  allowed_inbound_cidr_blocks_serf = var.allowed_inbound_cidr_blocks_serf

  allowed_inbound_tags_http = var.allowed_inbound_tags_http
  allowed_inbound_tags_rpc  = var.allowed_inbound_tags_rpc
  allowed_inbound_tags_serf = var.allowed_inbound_tags_serf

  http_port = 4646
  rpc_port  = 4647
  serf_port = 4648
}

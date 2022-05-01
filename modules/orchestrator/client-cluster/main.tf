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
    min_ready_sec           = var.instance_group_update_policy_min_ready_sec
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

    dynamic "access_config" {
      for_each = var.assign_public_ip_addresses ? ["public_ip"] : []
      content {
      }
    }
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

data "google_compute_network" "default" {
  name = "default"
}

# backend subnet
resource "google_compute_subnetwork" "backend_subnet" {
  name          = "orch-server-backend-subnet"
  provider      = google-beta
  ip_cidr_range = "10.0.1.0/24"
  network       = data.google_compute_network.default.id
}

resource "google_compute_instance_group_manager" "server_cluster" {
  name               = "${var.cluster_name}-ig"
  base_instance_name = var.cluster_name

  provider = google-beta

  wait_for_instances        = true
  wait_for_instances_status = "UPDATED"

  version {
    instance_template = google_compute_instance_template.server.self_link
  }

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

  target_pools = var.instance_group_target_pools
  target_size  = var.cluster_size

  depends_on = [
    google_compute_instance_template.server,
    google_compute_subnetwork.backend_subnet,
  ]

  lifecycle {
    create_before_destroy = true
  }
}

data "google_compute_image" "source_image" {
  family = "orch"
}

resource "google_compute_instance_template" "server" {
  name_prefix = "${var.cluster_name}-"

  instance_description = var.cluster_description
  machine_type         = var.machine_type

  depends_on = [
    google_compute_subnetwork.backend_subnet,
  ]

  tags                    = concat([var.cluster_tag_name], var.custom_tags)
  metadata_startup_script = var.startup_script
  metadata = merge(
    {
      "${var.metadata_key_name_for_cluster_size}" = var.cluster_size,

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
    source_image = data.google_compute_image.source_image.self_link
    disk_size_gb = var.root_volume_disk_size_gb
    disk_type    = var.root_volume_disk_type
  }

  network_interface {
    network    = var.network_name
    subnetwork = google_compute_subnetwork.backend_subnet.id

    # Create access config dynamically. If a public ip is requested, we just need the empty `access_config` block
    # to automatically assign an external IP address.
    dynamic "access_config" {
      for_each = var.assign_public_ip_addresses ? ["public_ip"] : []
      content {
      }
    }
  }

  service_account {
    email = var.service_account_email
    scopes = concat(
      ["userinfo-email", "compute-ro", var.storage_access_scope],
      var.service_account_scopes,
    )
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


module "server_proxy" {
  source         = "./server-cluster-proxy"
  instance_group = google_compute_instance_group_manager.server_cluster.instance_group
  backend_subnet = google_compute_subnetwork.backend_subnet.id
}

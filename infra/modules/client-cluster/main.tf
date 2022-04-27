provider "google-beta" {
  region = var.gcp_region
}

# ---------------------------------------------------------------------------------------------------------------------
# CREATE A GCE MANAGED INSTANCE GROUP TO RUN CLIENTS
# ---------------------------------------------------------------------------------------------------------------------

# Create the Managed Instance Group where Nomad will run.
resource "google_compute_region_instance_group_manager" "client_cluster" {
  project = var.gcp_project_id
  name    = "${var.cluster_name}-ig"

  provider = google-beta

  version {
    name              = "v1"
    instance_template = data.template_file.compute_instance_template_self_link.rendered
  }

  base_instance_name = var.cluster_name
  region             = var.gcp_region

  update_policy {
    minimal_action  = "REPLACE"
    type            = "PROACTIVE"
    max_surge_fixed = 5
  }

  target_pools = var.instance_group_target_pools
  target_size  = var.cluster_size

  depends_on = [
    google_compute_instance_template.nomad_public,
    google_compute_instance_template.nomad_private,
  ]
}

resource "google_compute_disk" "fc-init-data" {
  name                      = "fc-init-data"
  type                      = "pd-ssd"
  zone                      = "us-central1-a"
  image                     = "fc-init-test-data"
  physical_block_size_bytes = 16384
}

# Create the Instance Template that will be used to populate the Managed Instance Group.
# NOTE: This Compute Instance Template is only created if var.assign_public_ip_addresses is true.
resource "google_compute_instance_template" "nomad_public" {
  count = var.assign_public_ip_addresses ? 1 : 0

  project = var.gcp_project_id

  name_prefix = var.cluster_name
  description = var.cluster_description

  instance_description = var.cluster_description
  machine_type         = var.machine_type

  tags                    = concat([var.cluster_tag_name], var.custom_tags)
  metadata_startup_script = var.startup_script
  metadata = merge(
    {
      "${var.metadata_key_name_for_cluster_size}" = var.cluster_size
    },
    var.custom_metadata,
  )

  min_cpu_platform = "Intel Haswell"

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    preemptible         = false
  }

  disk {
    boot         = true
    auto_delete  = true
    source_image = data.google_compute_image.source_image.self_link
    disk_size_gb = var.root_volume_disk_size_gb
    disk_type    = var.root_volume_disk_type
  }

  disk {
    source      = google_compute_disk.fc-init-data.name
    device_name = google_compute_disk.fc-init-data.name
    mode        = "READONLY"
  }

  network_interface {
    network = var.network_name
    access_config {
      # The presence of this property assigns a public IP address to each Compute Instance. We intentionally leave it
      # blank so that an external IP address is selected automatically.
      nat_ip = ""
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
    ignore_changes        = [attached_disk]
  }
}

# Create the Instance Template that will be used to populate the Managed Instance Group.
# NOTE: This Compute Instance Template is only created if var.assign_public_ip_addresses is false.
resource "google_compute_instance_template" "nomad_private" {
  count = var.assign_public_ip_addresses ? 0 : 1

  project = var.gcp_project_id

  name_prefix = var.cluster_name
  description = var.cluster_description

  instance_description = var.cluster_description
  machine_type         = var.machine_type

  tags                    = concat([var.cluster_tag_name], var.custom_tags)
  metadata_startup_script = var.startup_script
  metadata = merge(
    {
      "${var.metadata_key_name_for_cluster_size}" = var.cluster_size
    },
    var.custom_metadata,
  )

  min_cpu_platform = "Intel Haswell"

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    preemptible         = false
  }

  disk {
    boot         = true
    auto_delete  = true
    source_image = data.google_compute_image.source_image.self_link
  }

  disk {
    source      = google_compute_disk.fc-init-data.name
    device_name = google_compute_disk.fc-init-data.name
    mode        = "READONLY"
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
    ignore_changes        = [attached_disk]
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# CREATE FIREWALL RULES
# ---------------------------------------------------------------------------------------------------------------------

module "firewall_rules" {
  source = "../nomad-firewall-rules"

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

# ---------------------------------------------------------------------------------------------------------------------
# CONVENIENCE VARIABLES
# Because we've got some conditional logic in this template, some values will depend on our properties. This section
# wraps such values in a nicer construct.
# ---------------------------------------------------------------------------------------------------------------------

# The Google Compute Instance Group needs the self_link of the Compute Instance Template that's actually created.
data "template_file" "compute_instance_template_self_link" {
  # This will return the self_link of the Compute Instance Template that is actually created. It works as follows:
  # - Make a list of 1 value or 0 values for each of google_compute_instance_template.consul_servers_public and
  #   google_compute_instance_template.consul_servers_private by adding the glob (*) notation. Terraform will complain
  #   if we directly reference a resource property that doesn't exist, but it will permit us to turn a single resource
  #   into a list of 1 resource and "no resource" into an empty list.
  # - Concat these lists. concat(list-of-1-value, empty-list) == list-of-1-value
  # - Take the first element of list-of-1-value
  template = element(
    concat(
      google_compute_instance_template.nomad_public.*.self_link,
      google_compute_instance_template.nomad_private.*.self_link,
    ),
    0,
  )
}

data "google_compute_image" "source_image" {
  family  = "orch"
  project = var.image_project_id != null ? var.image_project_id : var.gcp_project_id
}

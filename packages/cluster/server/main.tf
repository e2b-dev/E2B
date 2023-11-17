resource "google_compute_instance_group_manager" "server_cluster" {
  name               = "${var.cluster_name}-ig"
  base_instance_name = var.cluster_name

  provider = google-beta

  version {
    instance_template = google_compute_instance_template.server.id
  }

  named_port {
    name = "nomad"
    port = 4646
  }

  named_port {
    name = "consul"
    port = 8500
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
  ]

  lifecycle {
    # DEV ONLY - IGNORE CHANGES TO THE IMAGE
    ignore_changes = [
      version,
    ]
    create_before_destroy = false
  }
}

data "google_compute_image" "source_image" {
  family = var.image_family
}

resource "google_compute_instance_template" "server" {
  name_prefix = "${var.cluster_name}-"

  instance_description = var.cluster_description
  machine_type         = var.machine_type

  tags                    = concat([var.cluster_tag_name], var.custom_tags)
  metadata_startup_script = var.startup_script
  metadata = merge(
    {
      "${var.metadata_key_name_for_cluster_size}" = var.cluster_size,
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
    network = var.network_name

    # Create access config dynamically. If a public ip is requested, we just need the empty `access_config` block
    # to automatically assign an external IP address.
    dynamic "access_config" {
      for_each = var.assign_public_ip_addresses ? ["public_ip"] : []
      content {}
    }
  }

  service_account {
    email = var.service_account_email
    scopes = concat(
      [
        "userinfo-email",
        "compute-ro",
        "https://www.googleapis.com/auth/monitoring.write",
        "https://www.googleapis.com/auth/logging.write",
        "https://www.googleapis.com/auth/trace.append",
        "https://www.googleapis.com/auth/cloud-platform"
      ],
      var.service_account_scopes,
    )
  }

  # Per Terraform Docs (https://www.terraform.io/docs/providers/google/r/compute_instance_template.html#using-with-instance-group-manager),
  # we need to create a new instance template before we can destroy the old one. Note that any Terraform resource on
  # which this Terraform resource depends will also need this lifecycle statement.
  lifecycle {
    # DEV ONLY - IGNORE CHANGES TO THE IMAGE
    ignore_changes = [
      disk,
    ]
    create_before_destroy = true
  }
}

# LOAD BALANCERS

data "google_compute_global_address" "orch_server_ip" {
  name = "orch-server-nomad-ip"
}

data "google_compute_ssl_certificate" "nomad_certificate" {
  name = "e2b-nomad-api"
}

module "gce_lb_http_nomad" {
  source         = "GoogleCloudPlatform/lb-http/google"
  version        = "~> 9.3"
  name           = "orch-external-nomad-dashboard"
  project        = var.gcp_project_id
  address        = data.google_compute_global_address.orch_server_ip.address
  create_address = false
  target_tags = [
    var.cluster_tag_name,
  ]
  ssl_certificates = [
    data.google_compute_ssl_certificate.nomad_certificate.self_link,
  ]
  use_ssl_certificates = true
  ssl                  = true


  firewall_networks = [var.network_name]

  backends = {
    default = {
      description                     = null
      protocol                        = "HTTP"
      port                            = 80
      port_name                       = "nomad"
      timeout_sec                     = 10
      connection_draining_timeout_sec = 1
      enable_cdn                      = false
      security_policy                 = null
      session_affinity                = null
      affinity_cookie_ttl_sec         = null
      custom_request_headers          = null
      custom_response_headers         = null

      health_check = {
        check_interval_sec  = null
        timeout_sec         = null
        healthy_threshold   = null
        unhealthy_threshold = null
        request_path        = "/v1/status/peers"
        port                = 4646
        host                = null
        logging             = false
      }

      log_config = {
        enable      = false
        sample_rate = 0.0
      }

      groups = [
        {
          group                        = google_compute_instance_group_manager.server_cluster.instance_group
          balancing_mode               = null
          capacity_scaler              = null
          description                  = null
          max_connections              = null
          max_connections_per_instance = null
          max_connections_per_endpoint = null
          max_rate                     = null
          max_rate_per_instance        = null
          max_rate_per_endpoint        = null
          max_utilization              = null
        },
      ]

      iap_config = {
        enable               = false
        oauth2_client_id     = ""
        oauth2_client_secret = ""
      }
    }
  }
}

data "google_compute_global_address" "orch_server_consul_ip" {
  name = "orch-server-consul-ip"
}

data "google_compute_ssl_certificate" "consul_certificate" {
  name = "e2b-consul-api"
}

module "gce_lb_http_consul" {
  source         = "GoogleCloudPlatform/lb-http/google"
  version        = "~> 9.3"
  name           = "orch-external-consul-dashboard"
  project        = var.gcp_project_id
  address        = data.google_compute_global_address.orch_server_consul_ip.address
  create_address = false
  target_tags = [
    var.cluster_tag_name,
  ]

  ssl_certificates = [
    data.google_compute_ssl_certificate.consul_certificate.self_link,
  ]
  use_ssl_certificates = true
  ssl                  = true

  firewall_networks = [var.network_name]

  backends = {
    default = {
      description                     = null
      protocol                        = "HTTP"
      port                            = 80
      port_name                       = "consul"
      timeout_sec                     = 10
      connection_draining_timeout_sec = 1
      enable_cdn                      = false
      security_policy                 = null
      session_affinity                = null
      affinity_cookie_ttl_sec         = null
      custom_request_headers          = null
      custom_response_headers         = null

      health_check = {
        check_interval_sec  = null
        timeout_sec         = null
        healthy_threshold   = null
        unhealthy_threshold = null
        request_path        = "/v1/status/peers"
        port                = 8500
        host                = null
        logging             = false
      }

      log_config = {
        enable      = false
        sample_rate = 0.0
      }

      groups = [
        {
          group                        = google_compute_instance_group_manager.server_cluster.instance_group
          balancing_mode               = null
          capacity_scaler              = null
          description                  = null
          max_connections              = null
          max_connections_per_instance = null
          max_connections_per_endpoint = null
          max_rate                     = null
          max_rate_per_instance        = null
          max_rate_per_endpoint        = null
          max_utilization              = null
        },
      ]

      iap_config = {
        enable               = false
        oauth2_client_id     = ""
        oauth2_client_secret = ""
      }
    }
  }
}

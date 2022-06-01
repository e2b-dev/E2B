resource "google_compute_instance_group_manager" "client_cluster" {
  name = "${var.cluster_name}-ig"

  version {
    name              = google_compute_instance_template.client.id
    instance_template = google_compute_instance_template.client.id
  }

  provider = google-beta

  named_port {
    name = var.client_proxy_health_port.name
    port = var.client_proxy_health_port.port
  }

  named_port {
    name = var.client_proxy_port.name
    port = var.client_proxy_port.port
  }

  named_port {
    name = var.api_port.name
    port = var.api_port.port
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
    replacement_method      = "SUBSTITUTE"
  }

  base_instance_name = var.cluster_name
  target_size        = var.cluster_size
  target_pools       = var.instance_group_target_pools

  depends_on = [
    google_compute_instance_template.client,
  ]
}

data "google_compute_image" "source_image" {
  family = var.image_family
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
    disk_type    = var.root_volume_disk_type
  }

  disk {
    source      = "orch-firecracker-envs"
    auto_delete = false
    boot        = false
    device_name = "envs"
    mode        = "READ_WRITE"
  }

  network_interface {
    network = var.network_name

    dynamic "access_config" {
      for_each = var.assign_public_ip_addresses ? ["public_ip"] : []
      content {}
    }
  }

  # For a full list of oAuth 2.0 Scopes, see https://developers.google.com/identity/protocols/googlescopes
  service_account {
    scopes = [
      "userinfo-email",
      "compute-ro"
    ]
  }

  # Per Terraform Docs (https://www.terraform.io/docs/providers/google/r/compute_instance_template.html#using-with-instance-group-manager),
  # we need to create a new instance template before we can destroy the old one. Note that any Terraform resource on
  # which this Terraform resource depends will also need this lifecycle statement.
  lifecycle {
    create_before_destroy = true
  }
}

# LOAD BALANCERS

# This cert is for proxying throught Cloudflare only
data "google_compute_ssl_certificate" "session_certificate" {
  name = "sessions"
}

# This should be SSL cert for usage withotu Cloudflare
data "google_compute_ssl_certificate" "ondevbook_certificate" {
  name = "ondevbook"
}

resource "google_compute_url_map" "client_map" {
  name            = "orch-external-session-map-client"
  default_service = module.gce_lb_http.backend_services["session"].self_link

  host_rule {
    hosts        = ["ondevbook.com"]
    path_matcher = "api-paths"
  }

  host_rule {
    hosts        = ["*.ondevbook.com"]
    path_matcher = "session-paths"
  }

  path_matcher {
    name            = "api-paths"
    default_service = module.gce_lb_http.backend_services["api"].self_link
  }

  path_matcher {
    name            = "session-paths"
    default_service = module.gce_lb_http.backend_services["session"].self_link
  }
}

module "gce_lb_http" {
  source  = "GoogleCloudPlatform/lb-http/google"
  version = "~> 5.1"
  name    = "orch-external-session"
  project = var.gcp_project_id
  address = "34.120.40.50"
  ssl_certificates = [
    data.google_compute_ssl_certificate.session_certificate.self_link,
    data.google_compute_ssl_certificate.ondevbook_certificate.self_link,
  ]
  create_address       = false
  use_ssl_certificates = true
  ssl                  = true
  target_tags = [
    var.cluster_tag_name,
  ]
  firewall_networks = [var.network_name]

  create_url_map = false

  url_map = google_compute_url_map.client_map.self_link

  backends = {
    session = {
      description                     = null
      protocol                        = "HTTP"
      port                            = var.client_proxy_port.port
      port_name                       = var.client_proxy_port.name
      timeout_sec                     = 86400
      connection_draining_timeout_sec = null
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
        request_path        = var.client_proxy_health_port.path
        port                = var.client_proxy_health_port.port
        host                = null
        logging             = null
      }

      log_config = {
        enable      = true
        sample_rate = 1.0
      }

      groups = [
        {
          group                        = google_compute_instance_group_manager.client_cluster.instance_group
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
    api = {
      description                     = null
      protocol                        = "HTTP"
      port                            = var.api_port.port
      port_name                       = var.api_port.name
      timeout_sec                     = 30
      connection_draining_timeout_sec = null
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
        request_path        = var.api_port.health_path
        port                = var.api_port.port
        host                = null
        logging             = null
      }

      log_config = {
        enable      = true
        sample_rate = 1.0
      }

      groups = [
        {
          group                        = google_compute_instance_group_manager.client_cluster.instance_group
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

data "google_compute_network" "default" {
  name = "default"
}

# proxy-only subnet
resource "google_compute_subnetwork" "proxy_subnet" {
  name          = "orch-server-proxy-subnet"
  ip_cidr_range = "10.0.0.0/24"
  purpose       = "INTERNAL_HTTPS_LOAD_BALANCER"
  role          = "ACTIVE"
  network       = data.google_compute_network.default.id
}

# forwarding rule
resource "google_compute_forwarding_rule" "default" {
  name                  = "orch-server-forwarding-rule"
  depends_on            = [google_compute_subnetwork.proxy_subnet]
  ip_protocol           = "TCP"
  load_balancing_scheme = "INTERNAL_MANAGED"
  port_range            = "80"
  target                = google_compute_region_target_http_proxy.default.id
  network               = data.google_compute_network.default.id
  subnetwork            = var.backend_subnet
  network_tier          = "PREMIUM"
  # There should be only 3-5 nomad servers so most ip addresses here should be empty
  ip_address = "10.128.0.200"
}

# HTTP target proxy
resource "google_compute_region_target_http_proxy" "default" {
  name    = "orch-server-target-http-proxy"
  url_map = google_compute_region_url_map.default.id
}

# URL map
resource "google_compute_region_url_map" "default" {
  name            = "orch-server-url-map"
  default_service = google_compute_region_backend_service.default.id
}

# backend service
resource "google_compute_region_backend_service" "default" {
  name                  = "orch-server-backend-service"
  protocol              = "HTTP"
  load_balancing_scheme = "INTERNAL_MANAGED"
  timeout_sec           = 10
  health_checks         = [google_compute_region_health_check.default.id]
  backend {
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
    group           = var.instance_group
  }
}

# health check
resource "google_compute_region_health_check" "default" {
  name = "orch-server-hc"
  http_health_check {
    port               = 4646
    request_path       = "/v1/status/leader"
    port_specification = "USE_FIXED_PORT"
  }
}

# allow all access from IAP and health check ranges
resource "google_compute_firewall" "iap_firewall" {
  name          = "orch-server-iap-firewall"
  direction     = "INGRESS"
  network       = data.google_compute_network.default.id
  source_ranges = ["130.211.0.0/22", "35.191.0.0/16", "35.235.240.0/20"]
  allow {
    protocol = "tcp"
  }
}

# allow http from proxy subnet to backends
resource "google_compute_firewall" "backend_firewall" {
  name          = "orch-server-backend-firewall"
  direction     = "INGRESS"
  network       = data.google_compute_network.default.id
  source_ranges = ["10.0.0.0/24"]
  target_tags   = ["http-server"]
  allow {
    protocol = "tcp"
    ports    = ["80", "443", "8080"]
  }
}

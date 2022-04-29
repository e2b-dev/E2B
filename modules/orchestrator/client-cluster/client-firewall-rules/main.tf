# ---------------------------------------------------------------------------------------------------------------------
# CREATE FIREWALL RULES
# - These Firewall Rules may be redundant depending on the settings of your VPC Network, but if your Network is locked
#   down, these Rules will open up the appropriate ports.
# - Note that public access to your Nomad cluster will only be permitted if var.assign_public_ip_addresses is true.
# - Each Firewall Rule is only created if at least one source tag or source CIDR block for that Firewall Rule is specified.
# ---------------------------------------------------------------------------------------------------------------------

# Specify which traffic is allowed into the Nomad cluster for inbound HTTP requests
resource "google_compute_firewall" "allow_inbound_http" {
  count = length(var.allowed_inbound_cidr_blocks_http) + length(var.allowed_inbound_tags_http) > 0 ? 1 : 0

  name    = "${var.cluster_name}-rule-external-http-access"
  network = var.network_name

  allow {
    protocol = "tcp"
    ports = [
      var.http_port,
    ]
  }

  source_ranges = var.allowed_inbound_cidr_blocks_http
  source_tags   = var.allowed_inbound_tags_http
  target_tags   = [var.cluster_tag_name]
}

# Specify which traffic is allowed into the Nomad cluster for inbound RPC requests
resource "google_compute_firewall" "allow_inbound_rpc" {
  count = length(var.allowed_inbound_cidr_blocks_rpc) + length(var.allowed_inbound_tags_rpc) > 0 ? 1 : 0

  name    = "${var.cluster_name}-rule-external-rpc-access"
  network = var.network_name

  allow {
    protocol = "tcp"
    ports = [
      var.rpc_port,
    ]
  }

  source_ranges = var.allowed_inbound_cidr_blocks_rpc
  source_tags   = var.allowed_inbound_tags_rpc
  target_tags   = [var.cluster_tag_name]
}

# Specify which traffic is allowed into the Nomad cluster for inbound serf requests
resource "google_compute_firewall" "allow_inbound_serf" {
  count = length(var.allowed_inbound_cidr_blocks_serf) + length(var.allowed_inbound_tags_serf) > 0 ? 1 : 0

  name    = "${var.cluster_name}-rule-external-serf-access"
  network = var.network_name

  allow {
    protocol = "tcp"
    ports = [
      var.serf_port,
    ]
  }

  allow {
    protocol = "udp"
    ports = [
      var.serf_port,
    ]
  }

  source_ranges = var.allowed_inbound_cidr_blocks_serf
  source_tags   = var.allowed_inbound_tags_serf
  target_tags   = [var.cluster_tag_name]
}

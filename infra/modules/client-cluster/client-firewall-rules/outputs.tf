output "firewall_rule_allow_inbound_http_url" {
  value = google_compute_firewall.allow_inbound_http.*.self_link
}

output "firewall_rule_allow_inbound_http_id" {
  value = google_compute_firewall.allow_inbound_http.*.id
}

output "firewall_rule_allow_inbound_rpc_url" {
  value = google_compute_firewall.allow_inbound_rpc.*.self_link
}

output "firewall_rule_allow_inbound_rpc_id" {
  value = google_compute_firewall.allow_inbound_rpc.*.id
}

output "firewall_rule_allow_inbound_serf_url" {
  value = google_compute_firewall.allow_inbound_serf.*.self_link
}

output "firewall_rule_allow_inbound_serf_id" {
  value = google_compute_firewall.allow_inbound_serf.*.id
}

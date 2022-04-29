output "cluster_name" {
  value = var.cluster_name
}

output "cluster_tag_name" {
  value = var.cluster_tag_name
}

output "instance_group_url" {
  value = google_compute_instance_group_manager.server_cluster.self_link
}

output "instance_group_name" {
  value = google_compute_instance_group_manager.server_cluster.name
}

output "instance_template_url" {
  value = google_compute_instance_template.server.self_link
}

output "instance_template_name" {
  value = google_compute_instance_template.server.name
}

output "instance_template_metadata_fingerprint" {
  value = google_compute_instance_template.server.metadata_fingerprint
}

output "firewall_rule_intracluster_url" {
  value = google_compute_firewall.allow_intracluster_server.self_link
}

output "firewall_rule_intracluster_name" {
  value = google_compute_firewall.allow_intracluster_server.name
}

output "firewall_rule_inbound_http_url" {
  value = element(
    concat(
      google_compute_firewall.allow_inbound_http_api.*.self_link,
      [""],
    ),
    0,
  )
}

output "firewall_rule_inbound_http_name" {
  value = element(
    concat(google_compute_firewall.allow_inbound_http_api.*.name, [""]),
    0,
  )
}

output "firewall_rule_inbound_dns_url" {
  value = element(
    concat(google_compute_firewall.allow_inbound_dns.*.self_link, [""]),
    0,
  )
}

output "firewall_rule_inbound_dns_name" {
  value = element(
    concat(google_compute_firewall.allow_inbound_dns.*.name, [""]),
    0,
  )
}

output "nomad_address" {
  value = "http://${module.orch_server_proxy.orch_proxy_ip}"
}

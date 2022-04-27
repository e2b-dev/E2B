output "cluster_name" {
  value = var.cluster_name
}

output "cluster_tag_name" {
  value = var.cluster_name
}

output "instance_group_id" {
  value = google_compute_region_instance_group_manager.nomad.id
}

output "instance_group_url" {
  value = google_compute_region_instance_group_manager.nomad.self_link
}

output "instance_group_name" {
  value = google_compute_region_instance_group_manager.nomad.name
}

output "instance_template_url" {
  value = data.template_file.compute_instance_template_self_link.rendered
}

output "firewall_rule_allow_inbound_http_url" {
  value = module.firewall_rules.firewall_rule_allow_inbound_http_url
}

output "firewall_rule_allow_inbound_http_id" {
  value = module.firewall_rules.firewall_rule_allow_inbound_http_id
}

output "firewall_rule_allow_inbound_rpc_url" {
  value = module.firewall_rules.firewall_rule_allow_inbound_rpc_url
}

output "firewall_rule_allow_inbound_rpc_id" {
  value = module.firewall_rules.firewall_rule_allow_inbound_rpc_id
}

output "firewall_rule_allow_inbound_serf_url" {
  value = module.firewall_rules.firewall_rule_allow_inbound_serf_url
}

output "firewall_rule_allow_inbound_serf_id" {
  value = module.firewall_rules.firewall_rule_allow_inbound_serf_id
}
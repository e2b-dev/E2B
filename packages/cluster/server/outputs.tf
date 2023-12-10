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

output "instance_group" {
  value = google_compute_instance_group_manager.server_cluster.instance_group
}
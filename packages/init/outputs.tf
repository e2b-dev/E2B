output "service_account_email" {
  value = google_service_account.infra_instances_service_account.email
}

output "consul_acl_token_secret_name" {
  value = google_secret_manager_secret.consul_acl_token.name
}

output "nomad_acl_token_secret_name" {
  value = google_secret_manager_secret.nomad_acl_token.name
}

output "grafana_api_key_secret_name" {
  value = google_secret_manager_secret.grafana_api_key.name
}

output "grafana_logs_username_secret_name" {
  value = google_secret_manager_secret.grafana_logs_username.name
}

output "grafana_traces_username_secret_name" {
  value = google_secret_manager_secret.grafana_traces_username.name
}

output "grafana_metrics_username_secret_name" {
  value = google_secret_manager_secret.grafana_metrics_username.name
}

output "grafana_logs_endpoint_secret_name" {
  value = google_secret_manager_secret.grafana_logs_endpoint.name
}

output "grafana_traces_endpoint_secret_name" {
  value = google_secret_manager_secret.grafana_traces_endpoint.name
}

output "grafana_metrics_endpoint_secret_name" {
  value = google_secret_manager_secret.grafana_metrics_endpoint.name
}

output "orchestration_repository_name" {
  value = google_artifact_registry_repository.orchestration_repository.name
}
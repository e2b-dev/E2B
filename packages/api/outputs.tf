output "api_docker_image_digest" {
  value = docker_image.api_image.repo_digest
}

output "api_secret" {
  value = random_password.api_secret.result
}

output "postgres_connection_string_secret_name" {
  value = google_secret_manager_secret.postgres_connection_string.name
}

output "posthog_api_key_secret_name" {
  value = google_secret_manager_secret.posthog_api_key.name
}

output "custom_envs_repository_name" {
  value = google_artifact_registry_repository.custom_environments_repository.name
}

output "google_service_account_key" {
  value = google_service_account_key.google_service_key.private_key
}


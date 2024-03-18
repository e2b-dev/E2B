output "docker_reverse_proxy_image_digest" {
  value = docker_image.docker_reverse_proxy_image.repo_digest
}

output "docker_reverse_proxy_service_account_key" {
  value = google_service_account_key.google_service_key.private_key
}

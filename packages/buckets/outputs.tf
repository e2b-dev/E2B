output "envs_docker_context_bucket_name" {
  value = google_storage_bucket.envs_docker_context.name
}

output "cluster_setup_bucket_name" {
  value = google_storage_bucket.setup_bucket.name
}

output "fc_env_pipeline_bucket_name" {
  description = "The name of the bucket to store the files for firecracker environment pipeline"
  value       = google_storage_bucket.fc_env_pipeline_bucket.name
}

output "fc_kernels_bucket_name" {
  value = google_storage_bucket.fc_kernels_bucket.name
}

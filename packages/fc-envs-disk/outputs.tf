output "disk_name" {
  description = "The name of the disk that will be created to store the envs"
  value       = google_compute_disk.fc_envs.name
}

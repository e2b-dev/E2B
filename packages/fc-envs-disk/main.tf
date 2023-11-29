terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "5.6.0"
    }
  }
}

resource "google_compute_disk" "fc_envs" {
  name        = "${var.prefix}fc-envs"
  description = "Disk for firecracker envs"
  type        = "pd-ssd"
  zone        = var.gcp_zone
  size        = var.fc_envs_disk_size
  labels      = var.labels
  lifecycle {
    prevent_destroy = true
  }
}

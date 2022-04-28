data "google_compute_image" "source_image" {
  family  = "fc-envs-disk-image"
  project = var.gcp_project_id
}

resource "google_compute_disk" "fc_envs_disk" {
  name                      = "fc-envs-disk"
  type                      = "pd-ssd"
  zone                      = "us-central1-a"
  image                     = data.google_compute_image.source_image.name
  physical_block_size_bytes = 16384
}

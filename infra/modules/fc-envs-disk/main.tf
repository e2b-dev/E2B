data "google_compute_image" "source_image" {
  family = "fc-envs"
}

resource "google_compute_disk" "fc_envs_disk" {
  name  = "fc-envs-disk"
  type  = "pd-ssd"
  image = data.google_compute_image.source_image.name
}

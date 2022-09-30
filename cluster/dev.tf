# Development server

data "google_compute_image" "source_image" {
  family = var.client_image_family
}

data "google_secret_manager_secret_version" "lightstep_api_key" {
  secret = "lightstep-api-key-dev"
}

resource "google_compute_instance" "dev_instance" {
  name         = "dev-instance"
  machine_type = "n1-standard-1"

  network_interface {
    network = "default"
    access_config {}
  }

  service_account {
    scopes = [
      "userinfo-email",
      "compute-ro"
    ]
  }

  desired_status            = "TERMINATED"
  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = data.google_compute_image.source_image.id
      size  = 10
      type  = "pd-ssd"
    }
  }

  attached_disk {
    source      = "dev-orch-firecracker-envs"
    mode        = "READ_WRITE"
    device_name = "envs"
  }

  metadata_startup_script = templatefile("${path.module}/scripts/start-dev.sh", { telemetry_api_key = data.google_secret_manager_secret_version.lightstep_api_key.secret_data })
}

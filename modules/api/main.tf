data "google_container_registry_image" "api_image" {
  name = var.api_image_name
}

resource "google_cloud_run_service" "api_service" {
  name                       = "orchestration-api"
  location                   = "us-central1"
  autogenerate_revision_name = true

  template {
    spec {
      containers {
        image = data.google_container_registry_image.api_image.id
        env {
          name  = "NOMAD_ADDRESS"
          value = var.server_proxy_ip
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

resource "google_cloud_run_service_iam_member" "run_all_users" {
  service  = google_cloud_run_service.api_service.name
  location = google_cloud_run_service.api_service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

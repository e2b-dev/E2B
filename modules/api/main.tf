data "google_container_registry_image" "api_image" {
  name = var.api_image_name
}

resource "nomad_job" "orchestration_api" {
  jobspec = file("${path.module}/orchestration-api.hcl.tmpl")

  depends_on = [
    data.google_container_registry_image.api_image
  ]

  hcl2 {
    enabled = true
    vars = {
      image_name    = data.google_container_registry_image.api_image.image_url
      nomad_address = var.nomad_address
    }
  }
}

data "google_container_registry_image" "api_image" {
  name = var.api_image_name
}

resource "nomad_job" "orchestration_api" {
  jobspec = file("${path.module}/orchestration-api.hcl.tmpl")

  hcl2 {
    enabled = true
    vars = {
      # image_name = "val"
      image_name = data.google_container_registry_image.api_image.image_url
      # nomad_address = "add"
      nomad_address = var.nomad_address
    }
  }
}

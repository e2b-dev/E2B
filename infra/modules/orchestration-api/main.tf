# TODO: Add correct address
provider "nomad" {
  address = "http://localhost:4646"
}

variable "project_id" {
  type    = string
  default = "devbookhq"
}

variable "api_image_name" {
  type    = string
  default = "orchestration-api"
}

data "google_container_registry_image" "api_image" {
  name    = var.api_image_name
  project = var.project_id
}

# Register a job
resource "nomad_job" "orchestration_api" {
  jobspec = file("${path.module}/orchestration-api.hcl.tmpl")

  hcl2 {
    enabled = true
    vars = {
      image_name = data.google_container_registry_image.api_image.image_url
    }
  }
}

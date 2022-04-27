# TODO: Add correct address
provider "nomad" {
  address = "http://localhost:4646"
}

variable "version" {
  default = "latest"
}

data "template_file" "job" {
  template = file("./orchestration-api.hcl.tmpl")

  vars {
    version = var.version
  }
}

# Register a job
resource "nomad_job" "orchestration_api" {
  jobspec = data.template_file.job.rendered
}

# TODO: Add correct address
provider "nomad" {
  address = "http://localhost:4646"
}

variable "version" {
  default = "latest"
}

data "template_file" "job" {
  template = file("./firecracker-sessions.hcl.tmpl")

  vars {
    version = var.version
  }
}

# Register a job
resource "nomad_job" "firecracker_sessions" {
  jobspec = data.template_file.job.rendered
}

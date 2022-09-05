resource "nomad_job" "nomad-otel-collector" {
  jobspec = file("${path.module}/nomad-otel-collector.hcl")

  hcl2 {
    enabled = true
    vars = {
      gcp_zone = var.gcp_zone
    }
  }
}

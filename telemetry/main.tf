resource "nomad_job" "otel-collector" {
  jobspec = file("${path.module}/otel-collector.hcl")

  hcl2 {
    enabled = true
    vars = {
      lightstep_api_key = var.lightstep_api_key
      gcp_zone          = var.gcp_zone
    }
  }
}

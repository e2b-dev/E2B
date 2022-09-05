data "google_secret_manager_secret_version" "lightstep_api_key" {
  secret = "lightstep-api-key"
}

resource "nomad_job" "otel-collector" {
  jobspec = file("${path.module}/otel-collector.hcl")

  hcl2 {
    enabled = true
    vars = {
      lightstep_api_key = data.google_secret_manager_secret_version.lightstep_api_key.secret_data
      gcp_zone          = var.gcp_zone
    }
  }
}

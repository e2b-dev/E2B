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

resource "nomad_job" "logs-collector" {
  jobspec = file("${path.module}/logs-collector.hcl")

  hcl2 {
    enabled = true
    vars = {
      logs_port_number = var.logs_proxy_port.port
      logs_port_name   = var.logs_proxy_port.name
      gcp_zone         = var.gcp_zone
    }
  }
}

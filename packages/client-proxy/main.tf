terraform {
  required_providers {
    nomad = {
      source  = "hashicorp/nomad"
      version = "~> 2.0.0"
    }
  }
}

resource "nomad_job" "client_proxy" {
  jobspec = file("${path.module}/client-proxy.hcl")

  hcl2 {
    vars = {
      gcp_zone                        = var.gcp_zone
      client_proxy_port_number        = var.client_proxy_port.port
      client_proxy_port_name          = var.client_proxy_port.name
      client_proxy_health_port_number = var.client_proxy_health_port.port
      client_proxy_health_port_name   = var.client_proxy_health_port.name
      client_proxy_health_port_path   = var.client_proxy_health_port.path
      session_proxy_service_name      = var.session_proxy_service_name
      domain_name                     = var.domain_name
    }
  }
}

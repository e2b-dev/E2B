terraform {
  required_providers {
    nomad = {
      source  = "hashicorp/nomad"
      version = "2.0.0"
    }
  }
}

resource "nomad_job" "session_proxy" {
  jobspec = file("${path.module}/session-proxy.hcl")

  hcl2 {
    vars = {
      gcp_zone                   = var.gcp_zone
      client_cluster_size        = var.client_cluster_size
      session_proxy_port_number  = var.session_proxy_port.port
      session_proxy_port_name    = var.session_proxy_port.name
      session_proxy_service_name = var.session_proxy_service_name
    }
  }
}

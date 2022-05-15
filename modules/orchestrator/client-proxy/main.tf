resource "nomad_job" "client_proxy" {
  jobspec = file("${path.module}/client-proxy.hcl")

  hcl2 {
    enabled  = true
    vars = {
      gcp_zone = var.gcp_zone
    }
  }
}

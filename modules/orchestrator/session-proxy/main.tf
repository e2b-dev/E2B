resource "nomad_job" "session_proxy" {
  jobspec = file("${path.module}/session-proxy.hcl")

  hcl2 {
    enabled = true
    vars = {
      gcp_zone = var.gcp_zone
      client_cluster_size = var.client_cluster_size
    }
  }
}

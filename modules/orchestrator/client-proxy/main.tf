data "nomad_job" "session_proxy" {
  job_id = "session-proxy"
}

resource "nomad_job" "client_proxy" {
  jobspec = file("${path.module}/client-proxy.hcl")

  hcl2 {
    enabled = true
    vars = {
      gcp_zone = var.gcp_zone
      client_cluster_size = var.client_cluster_size
      #session_proxy_job_index = data.nomad_job.session_proxy.modify_index
    }
  }
}

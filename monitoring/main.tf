# resource "nomad_job" "grafana" {
#   jobspec = file("${path.module}/grafana.hcl")

#   hcl2 {
#     enabled = true
#     vars = {
#       gcp_zone = var.gcp_zone
#     }
#   }
# }

resource "nomad_job" "fabio" {
  jobspec = file("${path.module}/fabio.hcl")

  hcl2 {
    enabled = true
    vars = {
      gcp_zone = var.gcp_zone
    }
  }
}

resource "nomad_job" "prometheus" {
  jobspec = file("${path.module}/prometheus.hcl")

  hcl2 {
    enabled = true
    vars = {
      gcp_zone = var.gcp_zone
    }
  }
}

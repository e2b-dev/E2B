resource "nomad_job" "firecracker_sessions" {
  jobspec = file("${path.module}/firecracker-sessions.hcl.tmpl")

  hcl2 {
    enabled  = true
    vars = {
      memfile_path     = var.memfile_path
      snapshot_path    = var.snapshot_path
      firecracker_path = var.firecracker_path
      gcp_zone         = var.gcp_zone
    }
  }
}

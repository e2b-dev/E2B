resource "nomad_job" "firecracker_session" {
  jobspec = file("${path.module}/firecracker-session.hcl.tmpl")

  hcl2 {
    enabled = true
    vars = {
      rootfs_path      = var.rootfs_path
      kernel_path      = var.kernel_path
      firecracker_path = var.firecracker_path
    }
  }
}

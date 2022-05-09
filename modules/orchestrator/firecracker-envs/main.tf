resource "nomad_job" "firecracker_envs" {
  jobspec = file("${path.module}/firecracker-envs.hcl")

  hcl2 {
    enabled = true
    vars = {
      gcp_zone          = var.gcp_zone
      out_dir           = var.out_dir
      rootfile_basename = var.out_files_basenames.rootfs.basename
      snapfile_basename = var.out_files_basenames.snap.snapfile_basename
      memfile_basename  = var.out_files_basenames.snap.memfile_basename
    }
  }
}

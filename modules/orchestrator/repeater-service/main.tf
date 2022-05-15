resource "nomad_job" "repeater" {
  jobspec = file("${path.module}/repeater.hcl")

  hcl2 {
    enabled  = true
  }
}

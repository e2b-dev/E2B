variable "gcp_zone" {
  type = string
}

job "firecracker-envs" {
  datacenters = [var.gcp_zone]
  type = "batch"

  group "env" {
    reschedule {
      attempts  = 0
      unlimited = false
    }

    restart {
      attempts = 0
      mode = "fail"
    }

    task "build-env" {

    }
  }
}

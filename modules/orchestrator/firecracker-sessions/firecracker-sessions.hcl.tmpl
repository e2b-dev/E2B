variable "memfile_path" {
  type = string
}

variable "snapshot_path" {
  type = string
}

variable "firecracker_path" {
  type = string
}

variable "gcp_zone" {
  type = string
}

job "firecracker-sessions" {
  datacenters = [var.gcp_zone]
  type = "batch"

  parameterized {}

  group "session" {
    reschedule {
      attempts  = 0
      unlimited = false
    }

    restart {
      attempts = 0
      mode = "fail"
    }

    task "start" {
      driver = "firecracker-task-driver"

      resources {
        memory_max = 1024
        memory = 512
        cpu = 500
      }

      config {
        Firecracker = var.firecracker_path
        MemFile     = var.memfile_path
        Snapshot    = var.snapshot_path
      }
    }
  }
}

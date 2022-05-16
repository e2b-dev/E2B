variable "memfile_path" {
  type = string
}

variable "snapshot_path" {
  type = string
}

variable "gcp_zone" {
  type = string
}

job "firecracker-sessions" {
  datacenters = [var.gcp_zone]
  type = "batch"

  parameterized {
    payload       = "forbidden"
    meta_required = ["SESSION_ID"]
  }

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

      env {
        NOMAD_NODE_ID = "${node.unique.id}"
      }

      resources {
        memory_max = 1024
        memory = 512
        cpu = 500
      }

      config {
        MemFile     = var.memfile_path
        Snapshot    = var.snapshot_path
        SessionID   = "${NOMAD_META_SESSION_ID}"
      }
    }
  }
}

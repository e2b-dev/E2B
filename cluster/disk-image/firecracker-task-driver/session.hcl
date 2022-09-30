job "session/dev" {
  datacenters = ["dc1"]
  type = "batch"

  priority = 40

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
        FC_ENVS_DISK = "/mnt/disks/fc-envs"
      }

      resources {
        memory_max = 256
        memory = 256
        cpu = 200
      }

      config {
        CodeSnippetID = "Go"
        SessionID   = "dev"
        EditEnabled = false
        SpanID = ""
        TraceID = ""
        LogsProxyAddress = ""
      }
    }
  }
}

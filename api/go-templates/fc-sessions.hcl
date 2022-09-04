job "{{ .JobName }}/{{ .SessionID }}" {
  datacenters = ["us-central1-a"]
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

    task {{ .FCTaskName }} {
      driver = "firecracker-task-driver"

      env {
        NOMAD_NODE_ID = "${node.unique.id}"
        FC_ENVS_DISK = "{{ .FCEnvsDisk }}"
      }

      resources {
        memory_max = 512
        memory = 512
        cpu = 500
      }

      config {
        CodeSnippetID = "{{ .CodeSnippetID }}"
        SessionID   = "{{ .SessionID }}"
        EditEnabled = "{{ .EditEnabled }}"
      }
    }
  }
}

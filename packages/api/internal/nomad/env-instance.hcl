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
        memory = 128
        cpu = 200
      }

      config {
        CodeSnippetID = "{{ .CodeSnippetID }}"
        ConsulToken   = "{{ .ConsulToken }}"
        SessionID   = "{{ .SessionID }}"
        SpanID = "{{ .SpanID }}"
        TraceID = "{{ .TraceID }}"
        LogsProxyAddress = "{{ .LogsProxyAddress }}"
      }
    }
  }
}

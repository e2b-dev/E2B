job "{{ .JobName }}/{{ .InstanceID }}" {
  datacenters = ["us-central1-a"]
  type = "batch"

  priority = 40

  group "instance" {
    reschedule {
      attempts  = 0
      unlimited = false
    }

    restart {
      attempts = 0
      mode = "fail"
    }

    task {{ .TaskName }} {
      driver = "env-instance-task-driver"

      env {
        NOMAD_NODE_ID = "${node.unique.id}"
        ENVS_DISK = "{{ .EnvsDisk }}"
      }

      resources {
        memory = 128
        cpu = 128
      }

      config {
        EnvID = "{{ .EnvID }}"
        InstanceID   = "{{ .InstanceID }}"
        ConsulToken   = "{{ .ConsulToken }}"
        LogsProxyAddress = "{{ .LogsProxyAddress }}"
        SpanID = "{{ .SpanID }}"
        TraceID = "{{ .TraceID }}"
        TeamID = "{{ .TeamID }}"
      }
    }
  }
}

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
      driver = "fc-instance-task-driver"

      env {
        NOMAD_NODE_ID = "${node.unique.id}"
        FC_ENVS_DISK = "{{ .EnvsDisk }}"
      }

      resources {
        memory = 128
        cpu = 200
      }

      config {
        EnvID = "{{ .EnvID }}"
        InstanceID   = "{{ .InstanceID }}"
        ConsulToken   = "{{ .ConsulToken }}"
        LogsProxyAddress = "{{ .LogsProxyAddress }}"
        SpanID = "{{ .SpanID }}"
        TraceID = "{{ .TraceID }}"
      }
    }
  }
}

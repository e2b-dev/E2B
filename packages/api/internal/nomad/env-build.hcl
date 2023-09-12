job "{{ .JobName }}/{{ .EnvID }}" {
  datacenters = ["us-central1-a"]
  type = "batch"

  priority = 20

  group "build" {
    reschedule {
      attempts  = 0
      unlimited = false
    }

    restart {
      attempts = 0
      mode = "fail"
    }

    task {{ .TaskName }} {
      driver = "env-build-task-driver"

      env {
        FC_ENVS_DISK = "{{ .EnvsDisk }}"
      }

      config {
        EnvID = "{{ .EnvID }}"
        ProvisionScript   = "{{ escapeHCL .ProvisionScript }}"
        DockerContextPath   = "{{ .DockerContextPath }}"
        SpanID = "{{ .SpanID }}"
        TraceID = "{{ .TraceID }}"
      }
    }
  }
}

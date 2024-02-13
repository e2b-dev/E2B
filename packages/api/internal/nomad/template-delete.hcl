job "{{ .JobName }}/{{ .TemplateID }}" {
  datacenters = ["us-central1-a"]
  type = "batch"

  priority = 40

  group "delete" {
    reschedule {
      attempts  = 0
      unlimited = false
    }

    restart {
      attempts = 0
      mode = "fail"
    }

    task {{ .TaskName }} {
      driver = "template-delete-task-driver"

      env {
        ENVS_DISK = "{{ .EnvsDisk }}"
        BUCKET_NAME = "{{ .BucketName }}"

        DOCKER_CONTEXTS_PATH = "{{ .DockerContextsPath }}"
        DOCKER_REGISTRY = "{{ .DockerRegistry }}"
        PROJECT_ID = "{{ .ProjectID }}"
        REGION = "{{ .Region }}"
      }

      resources {
        memory = 128
        cpu = 128
      }

      config {
        TemplateID = "{{ .TemplateID }}"

        SpanID = "{{ .SpanID }}"
        TraceID = "{{ .TraceID }}"
      }
    }
  }
}

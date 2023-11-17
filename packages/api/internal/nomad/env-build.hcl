job "{{ .JobName }}/{{ .EnvID }}-{{ .BuildID }}" {
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
        ENVS_DISK = "{{ .EnvsDisk }}"
        DOCKER_REGISTRY = "us-central1-docker.pkg.dev/e2b-prod/custom-environments"
        DOCKER_CONTEXTS_PATH = "/mnt/disks/docker-contexts/v1"
        ENVD_PATH = "/fc-vm/envd"
        KERNEL_IMAGE_PATH = "/fc-vm/vmlinux.bin"
        FIRECRACKER_BINARY_PATH = "/usr/bin/firecracker"
        CONTEXT_FILE_NAME = "context.tar.gz"
        API_SECRET = "{{ .APISecret }}"
        GOOGLE_SERVICE_ACCOUNT_BASE64 = "{{ .GoogleServiceAccountBase64 }}"
      }

      resources {
        memory = 512
        cpu = 512
      }

      config {
        StartCmd = "{{ .StartCmd }}"
        BuildID = "{{ .BuildID }}"
        EnvID = "{{ .EnvID }}"
        VCpuCount = "{{ .VCpuCount }}"
        DiskSizeMB = "{{ .DiskSizeMB }}"
        MemoryMB = "{{ .MemoryMB }}"
        SpanID = "{{ .SpanID }}"
        TraceID = "{{ .TraceID }}"
      }
    }
  }
}

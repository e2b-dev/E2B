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
        DOCKER_REGISTRY = "{{ .GCPRegion }}-docker.pkg.dev/{{ .GCPProjectID }}/{{ .DockerRepositoryName }}"
        DOCKER_CONTEXTS_PATH = "/mnt/disks/docker-contexts/v1"
        ENVD_PATH = "/fc-vm/envd"
        CONTEXT_FILE_NAME = "context.tar.gz"
        API_SECRET = "{{ .APISecret }}"
        GOOGLE_SERVICE_ACCOUNT_BASE64 = "{{ .GoogleServiceAccountBase64 }}"
        NOMAD_TOKEN = "{{ .NomadToken }}"
        KERNELS_DIR= "/fc-kernels"
        KERNEL_MOUNT_DIR="/fc-vm"
        KERNEL_NAME="vmlinux.bin"
        FC_BINARY_NAME="firecracker"
        FC_VERSIONS_DIR="/fc-versions"
      }

      resources {
        memory = 512
        cpu = 512
      }

      config {
        StartCmd = "{{ .StartCmd }}"
        BuildID = "{{ .BuildID }}"
        EnvID = "{{ .EnvID }}"
        FirecrackerVersion = "{{ .FirecrackerVersion }}"
        KernelVersion = "{{ .KernelVersion }}"
        VCpuCount = "{{ .VCpuCount }}"
        DiskSizeMB = "{{ .DiskSizeMB }}"
        MemoryMB = "{{ .MemoryMB }}"
        SpanID = "{{ .SpanID }}"
        TraceID = "{{ .TraceID }}"
      }
    }
  }
}

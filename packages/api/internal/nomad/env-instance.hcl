job "{{ .JobName }}/{{ .InstanceID }}" {
  datacenters = ["us-central1-a"]
  type = "batch"

  meta {
    {{ .EnvIDKey }} = "{{ .EnvID }}"
    {{ .AliasKey }} = "{{ .Alias }}"
    {{ .InstanceIDKey }} = "{{ .InstanceID }}"
    {{ .TeamIDKey }} = "{{ .TeamID }}"
    {{ .BuildIDKey }} = "{{ .BuildID }}"
    {{ .MaxInstanceLengthKey}} = "{{ .MaxInstanceLength }}"
    {{ .MetadataKey }} = "{{ .Metadata }}"
  }

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
        KERNELS_DIR= "/fc-kernels"
        KERNEL_MOUNT_DIR="/fc-vm"
        KERNEL_NAME="vmlinux.bin"
        FC_BINARY_NAME="firecracker"
        UFFD_BINARY_NAME="uffd"
        FC_VERSIONS_DIR="/fc-versions"
      }

      resources {
        memory = 128
        cpu = 128
      }

      config {
        HugePages = {{ .HugePages }}
        EnvID = "{{ .EnvID }}"
        InstanceID = "{{ .InstanceID }}"
        FirecrackerVersion = "{{ .FirecrackerVersion }}"
        KernelVersion = "{{ .KernelVersion }}"
        ConsulToken = "{{ .ConsulToken }}"
        LogsProxyAddress = "{{ .LogsProxyAddress }}"
        SpanID = "{{ .SpanID }}"
        TraceID = "{{ .TraceID }}"
        TeamID = "{{ .TeamID }}"
      }
    }
  }
}

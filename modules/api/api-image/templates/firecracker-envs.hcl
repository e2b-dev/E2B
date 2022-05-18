job "firecracker-envs/{{ .CodeSnippetID }}/{{ .Rand }}" {
  datacenters = ["us-central1-a"]
  type = "batch"

  group "build-env" {
    reschedule {
      attempts  = 0
      unlimited = false
    }

    restart {
      attempts = 0
      mode = "fail"
    }

    task "build-env" {
      driver = "raw_exec"

      artifact {
        source = "https://storage.googleapis.com/devbook-environment-pipeline/mkfcenv.tar.gz"
        destination = "local"
      }

      config {
        command = "local/mkfcenv/mkfcenv.sh"
        args = ["local/mkfcenv", "{{ escapeNewLines .Dockerfile }}", "{{ .CodeSnippetID }}"]
      }
    }
  }
}

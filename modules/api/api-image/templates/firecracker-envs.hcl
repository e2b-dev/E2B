job "firecracker-envs/{{ .CodeSnippetID }}" {
  datacenters = ["us-central1-a"]
  type = "batch"

  meta {
    # This makes sure the job always runs even though nothing has changed in the job spec file.
    # See section "Always Deploy a New Job Version" in https://storiesfromtheherd.com/nomad-tips-and-tricks-766878dfebf4
    run_uuid = "${uuidv4()}"
  }

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
      resources {
        memory  = 300
        cores   = 1
      }
      driver = "raw_exec"

      artifact {
        source = "https://storage.googleapis.com/devbook-environment-pipeline/mkfcenv.tar.gz"
        destination = "local"
      }

      config {
        command = "local/mkfcenv/mkfcenv.sh"
        args = ["${NOMAD_META_RUN_UUID}", "local/mkfcenv", "{{ escapeNewLines .Dockerfile }}", "{{ .CodeSnippetID }}"]
      }
    }
  }
}

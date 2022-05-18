job "test-envs/{{.CodeSnippetID}}" {
  datacenters = ["us-central1-a"]
  type = "batch"

  #parameterized {
  #  meta_required = ["CODE_SNIPPET_ID"]
  #  # Payload expects the contents of a Dockerfile.
  #  payload = "required"
  #}

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

      #dispatch_payload {
      #  # Will be in "local/mkfcenv/Dockerfile"
      #  file = "mkfcenv/Dockerfile"
      #}

      artifact {
        source = "https://storage.googleapis.com/devbook-environment-pipeline/mkenv.tar.gz"
        destination = "local"
      }

      config {
        command = "/usr/bin/bash"
        args = ["-c", "echo sleep 30 seconds && sleep 30 && echo done: {{.Dockerfile}}"]
        #command = "local/mkfcenv/mkfcenv.sh"
        #args = ["local/mkfcenv", "${NOMAD_META_CODE_SNIPPET_ID}"]
      }
    }
  }
}

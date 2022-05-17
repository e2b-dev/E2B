variable "gcp_zone" {
  type = string
}

job "firecracker-envs" {
  datacenters = [var.gcp_zone]
  type = "batch"

  parameterized {
    # Payload expects the contents of a Dockerfile.
    payload = "required"
  }

  group "env" {
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

      dispatch_payload {
        # Will be in "local/mkfcenv/Dockerfile"
        file = "mkfcenv/Dockerfile"
      }

      artifact {
        source = "https://storage.googleapis.com/devbook-environment-pipeline/mkenv.tar.gz"
        destination = "local"
      }

      config {
        command = "local/mkfcenv/mkfcenv.sh"
        args = ["local/mkfcenv"]
      }
    }
  }
}
